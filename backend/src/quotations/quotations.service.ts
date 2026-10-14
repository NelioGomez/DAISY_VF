import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockQuotation, TX_OPTIONS } from '../common/utils/locks';
import { fixed2 } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { DocumentLinesService, lineToData } from '../documents/document-lines.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { calculateTotals, TaxService } from '../documents/tax.service';
import { QuotationStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto, FilterQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { expireOverdueQuotations } from './quotation-expiry';
import { canTransition, isEditable } from './quotation-status';
import { resolveValidUntil } from './validity';

const QUOTATION_INCLUDE = {
  customer: { select: { id: true, name: true, ruc: true } },
  seller: { select: { id: true, username: true, firstName: true, lastName: true } },
  sale: { select: { id: true, invoiceNumber: true } },
  items: { include: { product: { select: { sku: true, name: true, stock: true } } }, orderBy: { id: 'asc' as const } },
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
  tax: Dec;
  total: Dec;
  status: QuotationStatus;
  notes: string | null;
  customer?: { id: string; name: string; ruc: string | null };
  seller?: { id: string; username: string; firstName: string; lastName: string };
  sale?: { id: string; invoiceNumber: string } | null;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: Dec;
    subtotal: Dec;
    product: { sku: string; name: string; stock: number };
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
        include: { customer: QUOTATION_INCLUDE.customer, seller: QUOTATION_INCLUDE.seller, sale: QUOTATION_INCLUDE.sale },
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
      const totals = calculateTotals(lines.map((l) => l.subtotal), await this.tax.getRate(tx));
      const code = await this.sequence.next(tx, 'QUOTATION', 'COT');
      return tx.quotation.create({
        data: {
          code,
          customerId: dto.customerId,
          sellerId: actor.id,
          validUntil,
          subtotal: fixed2(totals.subtotal),
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
        const totals = calculateTotals(lines.map((l) => l.subtotal), await this.tax.getRate(tx));
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        data.items = { create: lines.map(lineToData) };
        data.subtotal = fixed2(totals.subtotal);
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
      const q = await tx.quotation.findUnique({ where: { id }, select: { code: true, status: true } });
      if (!q) throw new NotFoundException('Cotización no encontrada');
      if (q.status !== QuotationStatus.DRAFT) {
        throw new ConflictException('Solo se pueden eliminar borradores; las demás cotizaciones se rechazan');
      }
      await tx.quotation.delete({ where: { id } });
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
      return tx.quotation.update({ where: { id }, data: { status: to }, include: QUOTATION_INCLUDE });
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
      tax: decimalToNumber(q.tax),
      total: decimalToNumber(q.total),
      status: q.status,
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
