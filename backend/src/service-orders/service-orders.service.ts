import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { lockServiceOrder, TX_OPTIONS } from '../common/utils/locks';
import { buildPagination } from '../common/utils/pagination';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { SaleStatus, ServiceOrderStatus, UserRole } from '../generated/prisma/client';
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
import { canAdvance, isFinal } from './service-order-status';

const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, username: true, firstName: true, lastName: true } },
  sale: { select: { id: true, invoiceNumber: true } },
} as const;

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
  notes: string | null;
  updatedAt: Date;
  customer?: { id: string; name: string; phone: string | null };
  technician?: { id: string; username: string; firstName: string; lastName: string } | null;
  sale?: { id: string; invoiceNumber: string } | null;
}

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
    return { data: rows as OrderRow[], pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string, actor: AuthUser) {
    const order = (await this.prisma.serviceOrder.findUnique({ where: { id }, include: ORDER_INCLUDE })) as OrderRow | null;
    // Para un técnico, una orden ajena "no existe".
    if (!order || (isTechnician(actor) && order.technicianId !== actor.id)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    return order;
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

      const code = await this.sequence.next(tx, 'SERVICE_ORDER', 'OPI');
      return tx.serviceOrder.create({
        data: {
          code,
          customerId: dto.customerId,
          description: dto.description,
          notes: dto.notes || null,
          technicianId: dto.technicianId ?? null,
          status: dto.technicianId ? ServiceOrderStatus.ASSIGNED : ServiceOrderStatus.REGISTERED,
        },
        include: ORDER_INCLUDE,
      });
    }, TX_OPTIONS)) as OrderRow;
    await this.log(actor, 'CREATE', created, `Orden ${created.code} registrada (${created.status})`, ip);
    return created;
  }

  async update(id: string, dto: UpdateServiceOrderDto, actor: AuthUser, ip?: string) {
    const updated = await this.locked(id, actor, async (tx, order) => {
      if (isFinal(order.status)) throw new ConflictException(`Una orden ${order.status} ya no se puede modificar`);
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
    return updated;
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
    return updated;
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
    return updated;
  }

  /** EN PROCESO → COMPLETADA. Registra la hora de término. */
  async complete(id: string, dto: CompleteServiceOrderDto, actor: AuthUser, ip?: string) {
    const updated = await this.locked(id, actor, (tx, order) => {
      this.assertTransition(order.status, ServiceOrderStatus.COMPLETED);
      return tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.COMPLETED,
          finishedAt: new Date(),
          ...(dto.summary && { notes: this.appendNote(order.notes, `Trabajo realizado: ${dto.summary}`) }),
        },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'COMPLETE', updated, `Orden ${updated.code} completada`, ip);
    return updated;
  }

  /** COMPLETADA → FACTURADA, asociándola a una venta vigente del mismo cliente. */
  async invoice(id: string, dto: InvoiceServiceOrderDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const updated = await this.locked(id, actor, async (tx, order) => {
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
    return updated;
  }

  async cancel(id: string, dto: CancelServiceOrderDto, actor: AuthUser, ip?: string) {
    this.assertStaff(actor);
    const updated = await this.locked(id, actor, (tx, order) => {
      this.assertTransition(order.status, ServiceOrderStatus.CANCELLED);
      return tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.CANCELLED,
          notes: this.appendNote(order.notes, `Cancelada: ${dto.reason}`),
        },
        include: ORDER_INCLUDE,
      });
    });
    await this.log(actor, 'CANCEL', updated, `Orden ${updated.code} cancelada: ${dto.reason}`, ip);
    return updated;
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
