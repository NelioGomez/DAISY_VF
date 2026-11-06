import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { addDays, dateRange, endOfDayNi } from '../common/utils/dates';
import { lockInquiry, lockServiceOrder, TX_OPTIONS } from '../common/utils/locks';
import { buildPagination } from '../common/utils/pagination';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { InquiryStatus, InquiryType, SaleStatus, ServiceOrderStatus, UserRole } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignTechnicianDto,
  CancelServiceOrderDto,
  CompleteServiceOrderDto,
  CreateServiceOrderDto,
  FilterServiceOrderDto,
  InvoiceServiceOrderDto,
  UpdateServiceOrderDto,
} from './dto/service-order.dto';
import { canAdvance, DEFAULT_SERVICE_WARRANTY_DAYS, isClosed } from './service-order-status';

const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, username: true, firstName: true, lastName: true } },
  sale: { select: { id: true, invoiceNumber: true } },
  // Garantía (mejora n.° 60): la compra o el servicio anterior que la cubre, y la solicitud web de origen.
  warrantySale: { select: { id: true, invoiceNumber: true, soldAt: true } },
  warrantyProduct: { select: { id: true, sku: true, name: true, warrantyDays: true } },
  warrantyOrder: { select: { id: true, code: true, warrantyUntil: true } },
  inquiry: { select: { id: true, code: true } },
} as const;

/** Una garantía cubre hasta el final del día en que vence. */
const warrantyEnd = (from: Date, days: number) => endOfDayNi(addDays(from, days));

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('es-NI', { timeZone: 'America/Managua', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);

const FORBIDDEN = 'No tiene permisos para realizar esta acción';

interface OrderRow {
  id: string;
  code: string;
  customerId: string;
  description: string;
  technicianId: string | null;
  saleId: string | null;
  status: ServiceOrderStatus;
  registeredAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  notes: string | null;
  underWarranty: boolean;
  warrantySaleId: string | null;
  warrantyProductId: string | null;
  warrantyOrderId: string | null;
  serviceWarrantyDays: number | null;
  warrantyUntil: Date | null;
  inquiryId: string | null;
  updatedAt: Date;
  customer?: { id: string; name: string; phone: string | null };
  technician?: { id: string; username: string; firstName: string; lastName: string } | null;
  sale?: { id: string; invoiceNumber: string } | null;
  warrantySale?: { id: string; invoiceNumber: string; soldAt: Date } | null;
  warrantyProduct?: { id: string; sku: string; name: string; warrantyDays: number | null } | null;
  warrantyOrder?: { id: string; code: string; warrantyUntil: Date | null } | null;
  inquiry?: { id: string; code: string } | null;
  warrantyClaims?: { id: string; code: string; status: ServiceOrderStatus }[];
}

/** Hasta cuándo cubre la garantía que ampara la orden (compra + días del producto, o el servicio anterior). */
function coverage(o: OrderRow): { source: 'PURCHASE' | 'SERVICE'; until: Date | null } | null {
  if (!o.underWarranty) return null;
  if (o.warrantySale && o.warrantyProduct) {
    return { source: 'PURCHASE', until: o.warrantyProduct.warrantyDays ? warrantyEnd(o.warrantySale.soldAt, o.warrantyProduct.warrantyDays) : null };
  }
  return { source: 'SERVICE', until: o.warrantyOrder?.warrantyUntil ?? null };
}

const toDto = (o: OrderRow) => ({ ...o, coverage: coverage(o) });

const isTechnician = (u: AuthUser): boolean => u.role === UserRole.TECHNICIAN;

/**
 * Un técnico solo ve y avanza SUS órdenes; crear, asignar, facturar y cancelar
 * es trabajo del personal administrativo (no técnicos).
 */
@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequence: DocumentSequenceService,
  ) {}

  async findAll(filter: FilterServiceOrderDto, actor: AuthUser) {
    const { page, limit } = filter;
    const range = dateRange(filter.from, filter.to);
    const where: Prisma.ServiceOrderWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.warranty !== undefined && { underWarranty: filter.warranty }),
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(isTechnician(actor)
        ? { technicianId: actor.id }
        : filter.technicianId && { technicianId: filter.technicianId }),
      ...(range && { registeredAt: range }),
      ...(filter.search && {
        OR: [
          { code: { contains: filter.search, mode: 'insensitive' as const } },
          { description: { contains: filter.search, mode: 'insensitive' as const } },
          { customer: { name: { contains: filter.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.serviceOrder.count({ where }),
      this.prisma.serviceOrder.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: (rows as OrderRow[]).map(toDto), pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string, actor: AuthUser) {
    const order = (await this.prisma.serviceOrder.findUnique({
      where: { id },
      // En el detalle: los reclamos posteriores atendidos con la garantía de este trabajo.
      include: { ...ORDER_INCLUDE, warrantyClaims: { select: { id: true, code: true, status: true }, orderBy: { registeredAt: 'asc' } } },
    })) as OrderRow | null;
    // Para un técnico, una orden ajena "no existe".
    if (!order || (isTechnician(actor) && order.technicianId !== actor.id)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    return toDto(order);
  }

  /**
   * Qué puede cubrir una garantía de este cliente: productos comprados con garantía (vigente o
   * vencida, para que se vea por qué no aplica) y servicios cuya garantía de trabajo sigue en pie.
   */
  async warrantyOptions(customerId: string) {
    const now = new Date();
    const [items, orders] = await Promise.all([
      this.prisma.saleItem.findMany({
        where: { sale: { customerId, status: SaleStatus.ACTIVE }, product: { warrantyDays: { not: null } } },
        select: {
          quantity: true,
          sale: { select: { id: true, invoiceNumber: true, soldAt: true } },
          product: { select: { id: true, sku: true, name: true, warrantyDays: true } },
        },
        orderBy: { sale: { soldAt: 'desc' } },
        take: 200,
      }),
      this.prisma.serviceOrder.findMany({
        where: { customerId, warrantyUntil: { not: null }, status: { in: [ServiceOrderStatus.COMPLETED, ServiceOrderStatus.INVOICED] } },
        select: { id: true, code: true, description: true, finishedAt: true, warrantyUntil: true },
        orderBy: { finishedAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      purchases: items.map((i) => {
        const until = warrantyEnd(i.sale.soldAt, i.product.warrantyDays ?? 0);
        return {
          saleId: i.sale.id,
          invoiceNumber: i.sale.invoiceNumber,
          soldAt: i.sale.soldAt,
          productId: i.product.id,
          sku: i.product.sku,
          name: i.product.name,
          quantity: i.quantity,
          warrantyDays: i.product.warrantyDays,
          until,
          valid: until >= now,
        };
      }),
      services: orders.map((o) => ({
        orderId: o.id,
        code: o.code,
        description: o.description,
        finishedAt: o.finishedAt,
        until: o.warrantyUntil,
        valid: !!o.warrantyUntil && o.warrantyUntil >= now,
      })),
    };
  }

  /** Técnicos activos, para el selector de asignación. */
  async technicians() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { code: UserRole.TECHNICIAN } },
      select: { id: true, username: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async create(dto: CreateServiceOrderDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId }, select: { isActive: true } });
      if (!customer) throw this.fieldError('customerId', 'El cliente no existe');
      if (!customer.isActive) throw this.fieldError('customerId', 'El cliente está inactivo');
      if (dto.technicianId) await this.assertTechnician(tx, dto.technicianId);
      if (!dto.underWarranty && (dto.warrantySaleId || dto.warrantyProductId || dto.warrantyOrderId)) {
        throw this.fieldError('underWarranty', 'Marque la orden como garantía para indicar qué la cubre');
      }
      const warranty = dto.underWarranty ? await this.resolveWarranty(tx, dto.customerId, dto) : null;
      const inquiry = dto.inquiryId ? await this.assertInquiry(tx, dto.inquiryId, dto.customerId) : null;

      const code = await this.sequence.next(tx, 'SERVICE_ORDER', 'OPI');
      const order = await tx.serviceOrder.create({
        data: {
          code,
          customerId: dto.customerId,
          description: dto.description,
          notes: dto.notes || null,
          technicianId: dto.technicianId ?? null,
          status: dto.technicianId ? ServiceOrderStatus.ASSIGNED : ServiceOrderStatus.REGISTERED,
          underWarranty: !!warranty,
          ...(warranty ?? {}),
          inquiryId: inquiry?.id ?? null,
        },
        include: ORDER_INCLUDE,
      });
      // La solicitud queda atendida con esta orden (y enlazada al cliente si llegó sin ficha).
      if (inquiry) {
        await tx.webInquiry.update({
          where: { id: inquiry.id },
          data: { status: InquiryStatus.CLOSED, statusChangedAt: new Date(), customerId: inquiry.customerId ?? dto.customerId },
        });
      }
      return order;
    }, TX_OPTIONS)) as OrderRow;
    const extra = `${created.underWarranty ? ' en garantía' : ''}${created.inquiry ? ` desde ${created.inquiry.code}` : ''}`;
    await this.log(actor, 'CREATE', created, `Orden ${created.code} registrada (${created.status})${extra}`, ip);
    if (created.inquiry) {
      await this.audit.log({
        userId: actor.id,
        username: actor.username,
        module: 'inquiries',
        action: 'STATUS_CHANGE',
        entity: 'WebInquiry',
        entityId: created.inquiry.id,
        description: `Solicitud ${created.inquiry.code} atendida con la orden de servicio ${created.code}`,
        ip,
      });
    }
    return toDto(created);
  }

  async update(id: string, dto: UpdateServiceOrderDto, actor: AuthUser, ip?: string) {
    const updated = await this.locked(id, actor, async (tx, order) => {
      if (isClosed(order.status, order.underWarranty)) throw new ConflictException(`Una orden ${order.status} ya no se puede modificar`);
      if (dto.description !== undefined) {
        if (isTechnician(actor)) throw new ForbiddenException(FORBIDDEN);
        if (order.status !== ServiceOrderStatus.REGISTERED && order.status !== ServiceOrderStatus.ASSIGNED) {
          throw new ConflictException('La descripción solo se modifica antes de iniciar el trabajo');
        }
      }
      return tx.serviceOrder.update({
        where: { id },
        data: {
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.notes !== undefined && { notes: dto.notes || null }),
        },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'UPDATE', updated, `Orden ${updated.code} modificada`, ip);
    return toDto(updated);
  }

  /** REGISTRADA/ASIGNADA → ASIGNADA (permite reasignar mientras no haya iniciado). */
  async assign(id: string, dto: AssignTechnicianDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const updated = await this.locked(id, actor, async (tx, order) => {
      if (order.status !== ServiceOrderStatus.REGISTERED && order.status !== ServiceOrderStatus.ASSIGNED) {
        throw new ConflictException(`No se puede asignar una orden ${order.status}`);
      }
      await this.assertTechnician(tx, dto.technicianId);
      return tx.serviceOrder.update({
        where: { id },
        data: { technicianId: dto.technicianId, status: ServiceOrderStatus.ASSIGNED },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'ASSIGN', updated, `Orden ${updated.code} asignada a ${updated.technician?.username}`, ip);
    return toDto(updated);
  }

  /** ASIGNADA → EN PROCESO. Registra la hora de inicio. */
  async start(id: string, actor: AuthUser, ip?: string) {
    const updated = await this.locked(id, actor, (tx, order) => {
      this.assertTransition(order.status, ServiceOrderStatus.IN_PROGRESS);
      return tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.IN_PROGRESS, startedAt: new Date() },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'START', updated, `Orden ${updated.code} en proceso`, ip);
    return toDto(updated);
  }

  /**
   * EN PROCESO → COMPLETADA. Registra la hora de término y la garantía del trabajo realizado
   * (90 días si no se indica otra; 0 = sin garantía). En garantía, la orden queda cerrada.
   */
  async complete(id: string, dto: CompleteServiceOrderDto, actor: AuthUser, ip?: string) {
    const days = dto.warrantyDays ?? DEFAULT_SERVICE_WARRANTY_DAYS;
    const updated = await this.locked(id, actor, (tx, order) => {
      this.assertTransition(order.status, ServiceOrderStatus.COMPLETED);
      const now = new Date();
      return tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.COMPLETED,
          finishedAt: now,
          serviceWarrantyDays: days,
          warrantyUntil: days > 0 ? warrantyEnd(now, days) : null,
          ...(dto.summary && { notes: this.appendNote(order.notes, `Trabajo realizado: ${dto.summary}`) }),
        },
        include: ORDER_INCLUDE,
      });
    });
    const garantia = days > 0 ? `, garantía del trabajo hasta ${fmtDate(updated.warrantyUntil!)}` : ', sin garantía del trabajo';
    await this.log(actor, 'COMPLETE', updated, `Orden ${updated.code} completada${updated.underWarranty ? ' en garantía (sin costo)' : ''}${garantia}`, ip);
    return toDto(updated);
  }

  /** COMPLETADA → FACTURADA, asociándola a una venta vigente del mismo cliente. */
  async invoice(id: string, dto: InvoiceServiceOrderDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const updated = await this.locked(id, actor, async (tx, order) => {
      if (order.underWarranty) throw new ConflictException('Una orden en garantía no se factura: el trabajo no se cobra');
      this.assertTransition(order.status, ServiceOrderStatus.INVOICED);
      const sale = await tx.sale.findUnique({
        where: { id: dto.saleId },
        select: { customerId: true, status: true },
      });
      if (!sale) throw this.fieldError('saleId', 'La venta no existe');
      if (sale.status !== SaleStatus.ACTIVE) throw this.fieldError('saleId', 'La venta está anulada');
      if (sale.customerId !== order.customerId) {
        throw this.fieldError('saleId', 'La venta pertenece a otro cliente');
      }
      return tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.INVOICED, saleId: dto.saleId },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'INVOICE', updated, `Orden ${updated.code} facturada en ${updated.sale?.invoiceNumber}`, ip);
    return toDto(updated);
  }

  async cancel(id: string, dto: CancelServiceOrderDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const updated = await this.locked(id, actor, (tx, order) => {
      if (isClosed(order.status, order.underWarranty)) throw new ConflictException('La orden ya está cerrada');
      this.assertTransition(order.status, ServiceOrderStatus.CANCELLED);
      return tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.CANCELLED,
          notes: this.appendNote(order.notes, `Cancelada: ${dto.reason}`),
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
          // Un trabajo cancelado no deja garantía (si se canceló ya completado).
          serviceWarrantyDays: null,
          warrantyUntil: null,
        },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'CANCEL', updated, `Orden ${updated.code} cancelada: ${dto.reason}`, ip);
    return toDto(updated);
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Bloquea la orden, aplica el alcance del técnico y ejecuta la operación en la misma transacción. */
  private async locked(
    id: string,
    actor: AuthUser,
    work: (tx: Prisma.TransactionClient, order: OrderRow) => Promise<OrderRow> | OrderRow,
  ): Promise<OrderRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockServiceOrder(tx, id);
      const order = (await tx.serviceOrder.findUnique({ where: { id } })) as OrderRow | null;
      if (!order || (isTechnician(actor) && order.technicianId !== actor.id)) {
        throw new NotFoundException('Orden de servicio no encontrada');
      }
      return work(tx, order);
    }, TX_OPTIONS);
  }

  private assertStaff(actor: AuthUser) {
    if (isTechnician(actor)) throw new ForbiddenException(FORBIDDEN);
  }

  private assertTransition(from: ServiceOrderStatus, to: ServiceOrderStatus) {
    if (!canAdvance(from, to)) {
      throw new ConflictException(`No se puede pasar una orden de ${from} a ${to}`);
    }
  }

  private async assertTechnician(tx: Prisma.TransactionClient, userId: string) {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: { select: { code: true } } },
    });
    if (!u || u.role.code !== UserRole.TECHNICIAN) {
      throw this.fieldError('technicianId', 'El usuario no es un técnico');
    }
    if (!u.isActive) throw this.fieldError('technicianId', 'El técnico está inactivo');
  }

  /** Valida qué cubre la garantía: un producto comprado (vigente) o un servicio anterior (vigente). */
  private async resolveWarranty(tx: Prisma.TransactionClient, customerId: string, dto: CreateServiceOrderDto) {
    const bySale = !!(dto.warrantySaleId || dto.warrantyProductId);
    if (bySale === !!dto.warrantyOrderId) {
      throw this.fieldError('underWarranty', 'Indique qué cubre la garantía: un producto comprado o un servicio anterior');
    }
    const now = new Date();
    if (bySale) {
      if (!dto.warrantySaleId || !dto.warrantyProductId) throw this.fieldError('warrantyProductId', 'Indique la venta y el producto en garantía');
      const item = await tx.saleItem.findUnique({
        where: { saleId_productId: { saleId: dto.warrantySaleId, productId: dto.warrantyProductId } },
        select: {
          sale: { select: { customerId: true, status: true, invoiceNumber: true, soldAt: true } },
          product: { select: { name: true, warrantyDays: true } },
        },
      });
      if (!item) throw this.fieldError('warrantyProductId', 'Ese producto no está en la venta indicada');
      if (item.sale.customerId !== customerId) throw this.fieldError('warrantySaleId', 'La venta pertenece a otro cliente');
      if (item.sale.status !== SaleStatus.ACTIVE) throw this.fieldError('warrantySaleId', 'La venta está anulada');
      if (!item.product.warrantyDays) throw this.fieldError('warrantyProductId', `${item.product.name} no tiene garantía registrada`);
      const until = warrantyEnd(item.sale.soldAt, item.product.warrantyDays);
      if (until < now) {
        throw this.fieldError('warrantyProductId', `La garantía de ${item.product.name} (${item.sale.invoiceNumber}) venció el ${fmtDate(until)}`);
      }
      return { warrantySaleId: dto.warrantySaleId, warrantyProductId: dto.warrantyProductId, warrantyOrderId: null };
    }
    const prev = await tx.serviceOrder.findUnique({
      where: { id: dto.warrantyOrderId! },
      select: { customerId: true, code: true, status: true, warrantyUntil: true },
    });
    if (!prev) throw this.fieldError('warrantyOrderId', 'La orden anterior no existe');
    if (prev.customerId !== customerId) throw this.fieldError('warrantyOrderId', 'La orden anterior es de otro cliente');
    if (!prev.warrantyUntil || (prev.status !== ServiceOrderStatus.COMPLETED && prev.status !== ServiceOrderStatus.INVOICED)) {
      throw this.fieldError('warrantyOrderId', `${prev.code} no tiene garantía de trabajo`);
    }
    if (prev.warrantyUntil < now) throw this.fieldError('warrantyOrderId', `La garantía del trabajo de ${prev.code} venció el ${fmtDate(prev.warrantyUntil)}`);
    return { warrantySaleId: null, warrantyProductId: null, warrantyOrderId: dto.warrantyOrderId! };
  }

  /** La solicitud web que origina la orden: de servicio técnico o reclamo, abierta y sin otra orden. */
  private async assertInquiry(tx: Prisma.TransactionClient, inquiryId: string, customerId: string) {
    await lockInquiry(tx, inquiryId);
    const inq = await tx.webInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, code: true, status: true, type: true, customerId: true, serviceOrder: { select: { code: true } } },
    });
    if (!inq) throw this.fieldError('inquiryId', 'La solicitud no existe');
    if (inq.serviceOrder) throw new ConflictException(`La solicitud ${inq.code} ya tiene la orden ${inq.serviceOrder.code}`);
    if (inq.customerId && inq.customerId !== customerId) throw this.fieldError('customerId', `La solicitud ${inq.code} es de otro cliente`);
    if (inq.type !== InquiryType.SERVICE && inq.type !== InquiryType.COMPLAINT) {
      throw new ConflictException(`La solicitud ${inq.code} no es de servicio técnico ni un reclamo`);
    }
    if (inq.status !== InquiryStatus.NEW && inq.status !== InquiryStatus.IN_REVIEW) {
      throw new ConflictException(`La solicitud ${inq.code} ya fue atendida`);
    }
    return inq;
  }

  private appendNote(current: string | null, line: string): string {
    return current ? `${current}\n${line}` : line;
  }

  private fieldError(field: string, message: string) {
    return new BadRequestException({ message: 'Datos de la orden inválidos', errors: [{ field, message }] });
  }

  private log(actor: AuthUser, action: string, o: OrderRow, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'service-orders',
      action,
      entity: 'ServiceOrder',
      entityId: o.id,
      description,
      ip,
    });
  }
}
