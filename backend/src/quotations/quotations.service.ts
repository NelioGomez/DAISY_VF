import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockInquiry, lockQuotation, TX_OPTIONS } from '../common/utils/locks';
import { fixed2 } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { DocumentLinesService, lineToData } from '../documents/document-lines.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { calculateTotals, TaxService } from '../documents/tax.service';
import { InquiryStatus, InquiryType, QuotationStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto, CreateQuotationFromInquiryDto, FilterQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { expireOverdueQuotations } from './quotation-expiry';
import { canTransition, isEditable } from './quotation-status';
import { resolveValidUntil } from './validity';

const QUOTATION_INCLUDE = {
  customer: { select: { id: true, name: true, ruc: true } },
  seller: { select: { id: true, username: true, firstName: true, lastName: true } },
  sale: { select: { id: true, invoiceNumber: true, status: true } },
  // Solicitud web de origen: la cadena SOL → COT → FAC queda navegable.
  inquiry: { select: { id: true, code: true } },
  items: { include: { product: { select: { sku: true, name: true, stock: true, minStock: true } } }, orderBy: { id: 'asc' as const } },
} as const;

type Dec = { toString(): string };

interface QuotationRow {
  id: string;
  code: string;
  customerId: string;
  sellerId: string;
  issuedAt: Date;
  validUntil: Date;
  subtotal: Dec;
  taxRate: Dec;
  tax: Dec;
  total: Dec;
  status: QuotationStatus;
  statusChangedAt: Date;
  rejectionReason: string | null;
  inquiryId: string | null;
  notes: string | null;
  customer?: { id: string; name: string; ruc: string | null };
  seller?: { id: string; username: string; firstName: string; lastName: string };
  sale?: { id: string; invoiceNumber: string; status?: string } | null;
  inquiry?: { id: string; code: string } | null;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: Dec;
    subtotal: Dec;
    product: { sku: string; name: string; stock: number; minStock?: number };
  }[];
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tax: TaxService,
    private readonly sequence: DocumentSequenceService,
    private readonly lines: DocumentLinesService,
  ) {}

  async findAll(filter: FilterQuotationDto) {
    await expireOverdueQuotations(this.prisma);
    const { page, limit } = filter;
    const range = dateRange(filter.from, filter.to);
    const where: Prisma.QuotationWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(filter.sellerId && { sellerId: filter.sellerId }),
      ...(range && { issuedAt: range }),
      ...(filter.search && {
        OR: [
          { code: { contains: filter.search, mode: 'insensitive' as const } },
          { customer: { name: { contains: filter.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        include: {
          customer: QUOTATION_INCLUDE.customer,
          seller: QUOTATION_INCLUDE.seller,
          sale: QUOTATION_INCLUDE.sale,
          inquiry: QUOTATION_INCLUDE.inquiry,
        },
        orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: (rows as QuotationRow[]).map((q) => this.toDto(q)),
      pagination: buildPagination(page, limit, total),
    };
  }

  async findOne(id: string) {
    await expireOverdueQuotations(this.prisma);
    const q = (await this.prisma.quotation.findUnique({ where: { id }, include: QUOTATION_INCLUDE })) as QuotationRow | null;
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return this.toDto(q);
  }

  async create(dto: CreateQuotationDto, actor: AuthUser, ip?: string) {
    const validUntil = resolveValidUntil(dto.validUntil);
    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.assertCustomer(tx, dto.customerId);
      const lines = await this.lines.prepare(dto.items, tx);
      const rate = await this.tax.getRate(tx);
      const totals = calculateTotals(lines.map((l) => l.subtotal), rate);
      const code = await this.sequence.next(tx, 'QUOTATION', 'COT');
      return tx.quotation.create({
        data: {
          code,
          customerId: dto.customerId,
          sellerId: actor.id,
          validUntil,
          subtotal: fixed2(totals.subtotal),
          taxRate: rate.toFixed(4),
          tax: fixed2(totals.tax),
          total: fixed2(totals.total),
          status: dto.asDraft ? QuotationStatus.DRAFT : QuotationStatus.PENDING,
          notes: dto.notes || null,
          items: { create: lines.map(lineToData) },
        },
        include: QUOTATION_INCLUDE,
      });
    }, TX_OPTIONS)) as QuotationRow;

    await this.log(actor, 'CREATE', created, `Cotización ${created.code} creada (${created.status})`, ip);
    return this.toDto(created);
  }

  /**
   * Solicitud web → cotización (mejora n.° 45). Precarga el cliente y los productos de la solicitud;
   * el vendedor ajusta lo que haga falta. La solicitud NO se borra: pasa a COTIZADA, queda asignada a
   * quien cotizó y enlazada 1:1 con la cotización (quotations.inquiry_id, único).
   */
  async createFromInquiry(inquiryId: string, dto: CreateQuotationFromInquiryDto, actor: AuthUser, ip?: string) {
    const validUntil = resolveValidUntil(dto.validUntil);
    let inquiryCode = '';
    let created: QuotationRow;
    try {
      created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await lockInquiry(tx, inquiryId);
        const inquiry = await tx.webInquiry.findUnique({
          where: { id: inquiryId },
          select: {
            code: true,
            status: true,
            type: true,
            customerId: true,
            items: { select: { productId: true, quantity: true }, orderBy: { id: 'asc' } },
            quotation: { select: { code: true } },
          },
        });
        if (!inquiry) throw new NotFoundException('Solicitud no encontrada');
        inquiryCode = inquiry.code;
        if (inquiry.quotation) throw new ConflictException(`La solicitud ya tiene la cotización ${inquiry.quotation.code}`);
        if (inquiry.status !== InquiryStatus.NEW && inquiry.status !== InquiryStatus.IN_REVIEW) {
          throw new ConflictException(`Una solicitud ${inquiry.status} ya no se puede cotizar`);
        }
        // Mejora n.° 59: un mensaje de cuenta, reclamo o servicio no se cotiza.
        if (inquiry.type !== InquiryType.QUOTE) {
          throw new ConflictException(`La solicitud ${inquiry.code} no es un pedido de cotización; cambie su motivo si el cliente pide precios`);
        }

        const customerId = dto.customerId ?? inquiry.customerId;
        if (!customerId) {
          throw new BadRequestException({
            message: 'Datos de cotización inválidos',
            errors: [{ field: 'customerId', message: 'Seleccione o registre el cliente de esta solicitud' }],
          });
        }
        await this.assertCustomer(tx, customerId);

        const items = dto.items ?? inquiry.items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity }));
        if (!items.length) {
          throw new BadRequestException({
            message: 'Datos de cotización inválidos',
            errors: [{ field: 'items', message: 'La solicitud no indica productos: agréguelos a la cotización' }],
          });
        }
        const lines = await this.lines.prepare(items, tx);
        const rate = await this.tax.getRate(tx);
        const totals = calculateTotals(lines.map((l) => l.subtotal), rate);
        const code = await this.sequence.next(tx, 'QUOTATION', 'COT');
        const now = new Date();
        const quotation = await tx.quotation.create({
          data: {
            code,
            customerId,
            sellerId: actor.id,
            inquiryId,
            validUntil,
            subtotal: fixed2(totals.subtotal),
            taxRate: rate.toFixed(4),
            tax: fixed2(totals.tax),
            total: fixed2(totals.total),
            status: dto.asDraft ? QuotationStatus.DRAFT : QuotationStatus.PENDING,
            notes: dto.notes || null,
            items: { create: lines.map(lineToData) },
          },
          include: QUOTATION_INCLUDE,
        });
        // La solicitud se conserva como evidencia: cambia de estado y queda ligada al cliente y al vendedor.
        await tx.webInquiry.update({
          where: { id: inquiryId },
          data: { status: InquiryStatus.QUOTED, statusChangedAt: now, assignedToId: actor.id, customerId },
        });
        return quotation;
      }, TX_OPTIONS)) as QuotationRow;
    } catch (error) {
      // Dos vendedores cotizando la misma solicitud a la vez: la restricción única lo detiene.
      if (isUniqueViolation(error)) throw new ConflictException('La solicitud ya fue cotizada por otra persona');
      throw error;
    }

    await this.log(actor, 'CREATE', created, `Cotización ${created.code} creada desde la solicitud ${inquiryCode} (${created.status})`, ip);
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inquiries',
      action: 'QUOTE',
      entity: 'WebInquiry',
      entityId: inquiryId,
      description: `Solicitud ${inquiryCode} cotizada en ${created.code}`,
      ip,
    });
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateQuotationDto, actor: AuthUser, ip?: string) {
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockQuotation(tx, id);
      const current = await tx.quotation.findUnique({ where: { id }, select: { status: true, validUntil: true } });
      if (!current) throw new NotFoundException('Cotización no encontrada');
      if (!isEditable(current.status)) {
        throw new ConflictException(`Una cotización en estado ${current.status} ya no se puede modificar`);
      }
      if (current.validUntil.getTime() < Date.now()) {
        throw new ConflictException('La cotización está vencida; genere una nueva');
      }

      const data: Prisma.QuotationUpdateInput = {};
      if (dto.customerId !== undefined) {
        await this.assertCustomer(tx, dto.customerId);
        data.customer = { connect: { id: dto.customerId } };
      }
      if (dto.validUntil !== undefined) data.validUntil = resolveValidUntil(dto.validUntil);
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.items !== undefined) {
        const lines = await this.lines.prepare(dto.items, tx);
        const rate = await this.tax.getRate(tx);
        const totals = calculateTotals(lines.map((l) => l.subtotal), rate);
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        data.items = { create: lines.map(lineToData) };
        data.subtotal = fixed2(totals.subtotal);
        data.taxRate = rate.toFixed(4);
        data.tax = fixed2(totals.tax);
        data.total = fixed2(totals.total);
      }
      return tx.quotation.update({ where: { id }, data, include: QUOTATION_INCLUDE });
    }, TX_OPTIONS)) as QuotationRow;

    await this.log(actor, 'UPDATE', updated, `Cotización ${updated.code} modificada`, ip);
    return this.toDto(updated);
  }

  /** BORRADOR → PENDIENTE (se envía al cliente). */
  submit(id: string, actor: AuthUser, ip?: string) {
    return this.transition(id, QuotationStatus.PENDING, actor, 'SUBMIT', 'enviada', ip, [QuotationStatus.DRAFT]);
  }

  /** PENDIENTE → APROBADA (el cliente aceptó). */
  approve(id: string, actor: AuthUser, ip?: string) {
    return this.transition(id, QuotationStatus.APPROVED, actor, 'APPROVE', 'aprobada', ip);
  }

  reject(id: string, reason: string | undefined, actor: AuthUser, ip?: string) {
    return this.transition(id, QuotationStatus.REJECTED, actor, 'REJECT', 'rechazada', ip, undefined, reason);
  }

  /** Solo BORRADOR: una cotización ya enviada se rechaza, no se borra. */
  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const code = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockQuotation(tx, id);
      const q = await tx.quotation.findUnique({ where: { id }, select: { code: true, status: true, inquiryId: true } });
      if (!q) throw new NotFoundException('Cotización no encontrada');
      if (q.status !== QuotationStatus.DRAFT) {
        throw new ConflictException('Solo se pueden eliminar borradores; las demás cotizaciones se rechazan');
      }
      await tx.quotation.delete({ where: { id } });
      // Si el borrador venía de una solicitud web, la solicitud vuelve a revisión (puede cotizarse de nuevo).
      if (q.inquiryId) {
        await tx.webInquiry.updateMany({
          where: { id: q.inquiryId, status: InquiryStatus.QUOTED },
          data: { status: InquiryStatus.IN_REVIEW, statusChangedAt: new Date() },
        });
      }
      return q.code;
    }, TX_OPTIONS);
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'quotations',
      action: 'DELETE',
      entity: 'Quotation',
      entityId: id,
      description: `Borrador ${code} eliminado`,
      ip,
    });
  }

  // ───────────────────────── helpers ─────────────────────────

  private async transition(
    id: string,
    to: QuotationStatus,
    actor: AuthUser,
    action: string,
    verb: string,
    ip?: string,
    onlyFrom?: QuotationStatus[],
    reason?: string,
  ) {
    await expireOverdueQuotations(this.prisma);
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockQuotation(tx, id);
      const q = await tx.quotation.findUnique({ where: { id }, select: { status: true } });
      if (!q) throw new NotFoundException('Cotización no encontrada');
      if (q.status === QuotationStatus.EXPIRED) {
        throw new ConflictException('La cotización está vencida; genere una nueva');
      }
      if (!canTransition(q.status, to) || (onlyFrom && !onlyFrom.includes(q.status))) {
        throw new ConflictException(`No se puede pasar una cotización de ${q.status} a ${to}`);
      }
      return tx.quotation.update({
        where: { id },
        data: {
          status: to,
          statusChangedAt: new Date(),
          ...(to === QuotationStatus.REJECTED && reason ? { rejectionReason: reason } : {}),
        },
        include: QUOTATION_INCLUDE,
      });
    }, TX_OPTIONS)) as QuotationRow;

    await this.log(actor, action, updated, `Cotización ${updated.code} ${verb}${reason ? `: ${reason}` : ''}`, ip);
    return this.toDto(updated);
  }

  private async assertCustomer(tx: Prisma.TransactionClient, customerId: string) {
    const c = await tx.customer.findUnique({ where: { id: customerId }, select: { isActive: true } });
    const message = !c ? 'El cliente no existe' : !c.isActive ? 'El cliente está inactivo' : null;
    if (message) {
      throw new BadRequestException({
        message: 'Datos de cotización inválidos',
        errors: [{ field: 'customerId', message }],
      });
    }
  }

  private toDto(q: QuotationRow) {
    return {
      id: q.id,
      code: q.code,
      customer: q.customer,
      seller: q.seller,
      issuedAt: q.issuedAt,
      validUntil: q.validUntil,
      subtotal: decimalToNumber(q.subtotal),
      taxRate: decimalToNumber(q.taxRate),
      tax: decimalToNumber(q.tax),
      total: decimalToNumber(q.total),
      status: q.status,
      statusChangedAt: q.statusChangedAt,
      rejectionReason: q.rejectionReason,
      inquiryId: q.inquiryId,
      inquiry: q.inquiry ?? null,
      notes: q.notes,
      sale: q.sale ?? null,
      ...(q.items && {
        items: q.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          sku: i.product.sku,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: decimalToNumber(i.unitPrice),
          subtotal: decimalToNumber(i.subtotal),
          // Orientativo: ayuda al vendedor a ver si podrá facturar; el stock se valida al convertir.
          availableStock: i.product.stock,
          minStock: i.product.minStock ?? 0,
        })),
      }),
    };
  }

  private log(actor: AuthUser, action: string, q: QuotationRow, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'quotations',
      action,
      entity: 'Quotation',
      entityId: q.id,
      description,
      ip,
    });
  }
}
