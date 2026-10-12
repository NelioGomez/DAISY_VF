import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockQuotation, lockSale, TX_OPTIONS } from '../common/utils/locks';
import { Decimal, fixed2, fixed4 } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { DocumentLinesService, lineToData, PreparedLine } from '../documents/document-lines.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { calculateTotals, TaxService } from '../documents/tax.service';
import { PaymentStatus, QuotationStatus, SaleStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { expireOverdueQuotations } from '../quotations/quotation-expiry';
import { ConvertQuotationDto, CreateSaleDto, FilterSaleDto, VoidSaleDto } from './dto/sale.dto';
import { resolveTerms, SaleTermsInput } from './sale-terms';

const SALE_INCLUDE = {
  customer: { select: { id: true, name: true, ruc: true } },
  seller: { select: { id: true, username: true, firstName: true, lastName: true } },
  quotation: { select: { id: true, code: true } },
  items: { include: { product: { select: { sku: true, name: true } } }, orderBy: { id: 'asc' as const } },
  payments: { orderBy: { paidAt: 'asc' as const } },
} as const;

type Dec = { toString(): string };

interface SaleRow {
  id: string;
  invoiceNumber: string;
  customerId: string;
  sellerId: string;
  quotationId: string | null;
  soldAt: Date;
  subtotal: Dec;
  tax: Dec;
  total: Dec;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  balance: Dec;
  dueDate: Date | null;
  status: SaleStatus;
  voidedAt: Date | null;
  voidReason: string | null;
  customer?: { id: string; name: string; ruc: string | null };
  seller?: { id: string; username: string; firstName: string; lastName: string };
  quotation?: { id: string; code: string } | null;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: Dec;
    unitCost: Dec;
    subtotal: Dec;
    product: { sku: string; name: string };
  }[];
  payments?: {
    id: string;
    paidAt: Date;
    amount: Dec;
    method: string;
    reference: string | null;
    userId: string;
  }[];
}

interface SaleSource {
  customerId: string;
  sellerId: string;
  items?: CreateSaleDto['items'];
  quotation?: { id: string };
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly tax: TaxService,
    private readonly sequence: DocumentSequenceService,
    private readonly lines: DocumentLinesService,
  ) {}

  // ───────────────────────── consultas ─────────────────────────

  async findAll(filter: FilterSaleDto) {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);
    const [total, rows, agg] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: { customer: SALE_INCLUDE.customer, seller: SALE_INCLUDE.seller },
        orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.aggregate({
        where: { ...where, status: SaleStatus.ACTIVE },
        _sum: { total: true, balance: true },
      }),
    ]);
    return {
      data: (rows as SaleRow[]).map((s) => this.toDto(s)),
      pagination: buildPagination(page, limit, total),
      summary: {
        // Solo ventas vigentes: las anuladas no suman.
        activeTotal: agg._sum.total ? decimalToNumber(agg._sum.total) : 0,
        activeBalance: agg._sum.balance ? decimalToNumber(agg._sum.balance) : 0,
      },
    };
  }

  async findOne(id: string) {
    const sale = (await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE })) as SaleRow | null;
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.toDto(sale);
  }

  // ───────────────────────── creación ─────────────────────────

  /** Venta directa (sin cotización). */
  create(dto: CreateSaleDto, actor: AuthUser, ip?: string) {
    return this.execute({ customerId: dto.customerId, sellerId: actor.id, items: dto.items }, dto, actor, ip);
  }

  /** Conversión de una cotización APROBADA: usa los precios y totales ya cotizados. */
  async convertQuotation(quotationId: string, terms: ConvertQuotationDto, actor: AuthUser, ip?: string) {
    await expireOverdueQuotations(this.prisma);
    const q = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { customerId: true, sellerId: true },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return this.execute(
      { customerId: q.customerId, sellerId: q.sellerId, quotation: { id: quotationId } },
      terms,
      actor,
      ip,
    );
  }

  private async execute(source: SaleSource, terms: SaleTermsInput, actor: AuthUser, ip?: string) {
    let created: SaleRow;
    try {
      created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1) Cotización: bloqueo + verificación (evita conversiones duplicadas).
        let quotation: {
          status: QuotationStatus;
          code: string;
          subtotal: Dec;
          tax: Dec;
          total: Dec;
          items: { productId: string; quantity: number; unitPrice: Dec; subtotal: Dec; product: { sku: string; name: string } }[];
        } | null = null;
        if (source.quotation) {
          await lockQuotation(tx, source.quotation.id);
          quotation = await tx.quotation.findUnique({
            where: { id: source.quotation.id },
            select: {
              status: true,
              code: true,
              subtotal: true,
              tax: true,
              total: true,
              items: { select: { productId: true, quantity: true, unitPrice: true, subtotal: true, product: { select: { sku: true, name: true } } } },
            },
          });
          if (!quotation) throw new NotFoundException('Cotización no encontrada');
          if (quotation.status === QuotationStatus.CONVERTED) {
            throw new ConflictException('La cotización ya fue convertida en venta');
          }
          if (quotation.status === QuotationStatus.EXPIRED) {
            throw new ConflictException('La cotización está vencida; genere una nueva');
          }
          if (quotation.status !== QuotationStatus.APPROVED) {
            throw new ConflictException('Solo se puede convertir una cotización APROBADA');
          }
        }

        // 2) Cliente vigente.
        const customer = await tx.customer.findUnique({
          where: { id: source.customerId },
          select: { isActive: true },
        });
        if (!customer) throw this.fieldError('customerId', 'El cliente no existe');
        if (!customer.isActive) throw this.fieldError('customerId', 'El cliente está inactivo');

        // 3) Líneas y totales.
        let lines: PreparedLine[];
        let totals: { subtotal: Decimal; tax: Decimal; total: Decimal };
        if (quotation) {
          lines = quotation.items.map((i) => ({
            productId: i.productId,
            sku: i.product.sku,
            name: i.product.name,
            quantity: i.quantity,
            unitPrice: new Decimal(i.unitPrice.toString()),
            subtotal: new Decimal(i.subtotal.toString()),
          }));
          totals = {
            subtotal: new Decimal(quotation.subtotal.toString()),
            tax: new Decimal(quotation.tax.toString()),
            total: new Decimal(quotation.total.toString()),
          };
        } else {
          lines = await this.lines.prepare(source.items ?? [], tx);
          totals = calculateTotals(lines.map((l) => l.subtotal), await this.tax.getRate(tx));
        }
        if (totals.total.lessThanOrEqualTo(0)) {
          throw this.fieldError('items', 'El total de la venta debe ser mayor que cero');
        }

        // 4) Condiciones de pago.
        const soldAt = new Date();
        const resolved = resolveTerms(totals.total, terms, await this.tax.getCreditDays(tx), soldAt);

        // 5) Número de factura + salida de inventario (bloqueo ordenado de productos).
        const invoiceNumber = await this.sequence.next(tx, 'INVOICE', 'FAC');
        const saleId = randomUUID();
        const exits = await this.stock.registerExits(
          tx,
          lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          {
            userId: actor.id,
            reference: invoiceNumber,
            note: `Venta ${invoiceNumber}`,
            sourceEntity: 'Sale',
            sourceId: saleId,
          },
        );

        // 6) Venta + líneas (con el costo promedio de salida) + pago inicial.
        const sale = (await tx.sale.create({
          data: {
            id: saleId,
            invoiceNumber,
            customerId: source.customerId,
            sellerId: source.sellerId,
            quotationId: source.quotation?.id ?? null,
            soldAt,
            subtotal: fixed2(totals.subtotal),
            tax: fixed2(totals.tax),
            total: fixed2(totals.total),
            paymentMethod: terms.paymentMethod,
            paymentStatus: resolved.paymentStatus,
            balance: fixed2(resolved.balance),
            dueDate: resolved.dueDate,
            items: {
              create: lines.map((l, i) => ({
                ...lineToData(l),
                unitCost: fixed4(new Decimal(exits[i].movement.unitCost.toString())),
              })),
            },
            ...(resolved.payment && {
              payments: {
                create: [
                  {
                    amount: fixed2(resolved.payment.amount),
                    method: resolved.payment.method,
                    reference: resolved.payment.reference,
                    paidAt: soldAt,
                    userId: actor.id,
                  },
                ],
              },
            }),
          },
          include: SALE_INCLUDE,
        })) as SaleRow;

        if (source.quotation) {
          await tx.quotation.update({
            where: { id: source.quotation.id },
            data: { status: QuotationStatus.CONVERTED },
          });
        }
        return sale;
      }, TX_OPTIONS);
    } catch (error) {
      // Dos conversiones simultáneas de la misma cotización: la restricción única lo detiene.
      if (isUniqueViolation(error) && source.quotation) {
        throw new ConflictException('La cotización ya fue convertida en venta');
      }
      throw error;
    }

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'sales',
      action: source.quotation ? 'CONVERT' : 'CREATE',
      entity: 'Sale',
      entityId: created.id,
      description: `Factura ${created.invoiceNumber} por C$ ${created.total.toString()} (${created.paymentMethod})${
        created.quotation ? ` desde ${created.quotation.code}` : ''
      }`,
      ip,
    });
    return this.toDto(created);
  }

  // ───────────────────────── anulación ─────────────────────────

  /**
   * Anula la venta: devuelve el stock con una ENTRADA al costo al que salió, deja el saldo en 0
   * y conserva los pagos recibidos (informa cuánto debe reintegrarse: refundDue).
   */
  async voidSale(id: string, dto: VoidSaleDto, actor: AuthUser, ip?: string) {
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockSale(tx, id);
      const sale = await tx.sale.findUnique({
        where: { id },
        select: {
          invoiceNumber: true,
          status: true,
          items: { select: { productId: true, quantity: true, unitCost: true }, orderBy: { productId: 'asc' } },
          payments: { select: { amount: true } },
          _count: { select: { serviceOrders: true } },
        },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status === SaleStatus.VOIDED) throw new ConflictException('La venta ya está anulada');
      if (sale._count.serviceOrders > 0) {
        throw new ConflictException('La venta está vinculada a órdenes de servicio y no puede anularse');
      }

      // Se bloquean todos los productos en orden antes de devolver stock (evita interbloqueos).
      await this.stock.lockProducts(tx, sale.items.map((i: { productId: string }) => i.productId));
      for (const item of sale.items as { productId: string; quantity: number; unitCost: Dec }[]) {
        await this.stock.registerEntry(tx, {
          productId: item.productId,
          quantity: item.quantity,
          unitCost: new Decimal(item.unitCost.toString()),
          userId: actor.id,
          reference: sale.invoiceNumber,
          note: `Anulación de venta: ${dto.reason}`,
          sourceEntity: 'SaleVoid',
          sourceId: id,
        });
      }

      await tx.sale.update({
        where: { id },
        data: { status: SaleStatus.VOIDED, balance: '0.00', voidedAt: new Date(), voidReason: dto.reason },
      });
      const refundDue = (sale.payments as { amount: Dec }[]).reduce(
        (acc, p) => acc.plus(p.amount.toString()),
        new Decimal(0),
      );
      return { invoiceNumber: sale.invoiceNumber, refundDue };
    }, TX_OPTIONS);

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'sales',
      action: 'VOID',
      entity: 'Sale',
      entityId: id,
      description: `Venta ${result.invoiceNumber} anulada: ${dto.reason}`,
      ip,
      metadata: { refundDue: Number(result.refundDue.toFixed(2)) },
    });
    return { ...(await this.findOne(id)), refundDue: Number(result.refundDue.toFixed(2)) };
  }

  // ───────────────────────── helpers ─────────────────────────

  private buildWhere(f: FilterSaleDto): Prisma.SaleWhereInput {
    const range = dateRange(f.from, f.to);
    return {
      ...(f.customerId && { customerId: f.customerId }),
      ...(f.sellerId && { sellerId: f.sellerId }),
      ...(f.paymentStatus && { paymentStatus: f.paymentStatus }),
      ...(f.paymentMethod && { paymentMethod: f.paymentMethod }),
      ...(f.status && { status: f.status }),
      ...(range && { soldAt: range }),
      ...(f.overdue === true && {
        status: SaleStatus.ACTIVE,
        balance: { gt: 0 },
        dueDate: { lt: new Date() },
      }),
      ...(f.search && {
        OR: [
          { invoiceNumber: { contains: f.search, mode: 'insensitive' as const } },
          { customer: { name: { contains: f.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
  }

  private fieldError(field: string, message: string) {
    return new BadRequestException({ message: 'Datos de venta inválidos', errors: [{ field, message }] });
  }

  private toDto(s: SaleRow) {
    const balance = decimalToNumber(s.balance);
    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customer: s.customer,
      seller: s.seller,
      quotation: s.quotation ?? null,
      soldAt: s.soldAt,
      subtotal: decimalToNumber(s.subtotal),
      tax: decimalToNumber(s.tax),
      total: decimalToNumber(s.total),
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      balance,
      dueDate: s.dueDate,
      isOverdue: s.status === SaleStatus.ACTIVE && balance > 0 && !!s.dueDate && s.dueDate.getTime() < Date.now(),
      status: s.status,
      voidedAt: s.voidedAt,
      voidReason: s.voidReason,
      ...(s.items && {
        items: s.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          sku: i.product.sku,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: decimalToNumber(i.unitPrice),
          unitCost: decimalToNumber(i.unitCost),
          subtotal: decimalToNumber(i.subtotal),
        })),
      }),
      ...(s.payments && {
        payments: s.payments.map((p) => ({
          id: p.id,
          paidAt: p.paidAt,
          amount: decimalToNumber(p.amount),
          method: p.method,
          reference: p.reference,
          userId: p.userId,
        })),
      }),
    };
  }
}