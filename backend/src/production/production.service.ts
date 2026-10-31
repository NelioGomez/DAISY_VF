import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { parseBoundary } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockProductionLot, lockProductionOrder, TX_OPTIONS } from '../common/utils/locks';
import { Decimal, fixed2, fixed4 } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { InspectionResult, InspectionStage, Prisma, ProductionOrderStatus, ProductionStepStatus } from '../generated/prisma/client';
import { MOVEMENT_ORIGIN_INCLUDE } from '../inventory/movement-origin';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BomItemDto,
  CancelProductionOrderDto,
  CompleteProductionOrderDto,
  CompleteStepDto,
  CreateBomDto,
  CreateProductionOrderDto,
  CreateRouteDto,
  FilterLotDto,
  FilterProductionOrderDto,
  InspectLotDto,
  RouteOperationDto,
  UpdateBomDto,
  UpdateRouteDto,
} from './dto/production.dto';
import { applyInspection, canMoveOrder, lotStatus, materialPlan, unitCostOf } from './production-rules';

const PRODUCT_REF = { select: { id: true, sku: true, name: true, unit: true, stock: true, avgCost: true, isActive: true } } as const;

const BOM_INCLUDE = {
  product: PRODUCT_REF,
  items: { include: { component: PRODUCT_REF }, orderBy: { id: 'asc' as const } },
  _count: { select: { orders: true } },
} as const;

const ROUTE_INCLUDE = {
  product: PRODUCT_REF,
  operations: { orderBy: { sequence: 'asc' as const } },
  _count: { select: { orders: true } },
} as const;

const ORDER_LIST_INCLUDE = {
  product: PRODUCT_REF,
  bom: { select: { id: true, code: true, version: true } },
  lots: { select: { id: true, code: true, status: true, quantity: true, releasedQuantity: true, scrappedQuantity: true } },
  steps: { select: { status: true } },
} as const;

const ORDER_DETAIL_INCLUDE = {
  product: PRODUCT_REF,
  bom: { select: { id: true, code: true, version: true } },
  route: { select: { id: true, code: true, name: true } },
  createdBy: { select: { firstName: true, lastName: true, username: true } },
  consumptions: { include: { component: PRODUCT_REF }, orderBy: { id: 'asc' as const } },
  steps: {
    include: { completedBy: { select: { firstName: true, lastName: true, username: true } } },
    orderBy: { sequence: 'asc' as const },
  },
  lots: {
    include: { inspections: { include: { inspector: { select: { firstName: true, lastName: true, username: true } } }, orderBy: { inspectedAt: 'asc' as const } } },
    orderBy: { producedAt: 'asc' as const },
  },
  movements: {
    include: { product: { select: { sku: true, name: true } }, ...MOVEMENT_ORIGIN_INCLUDE },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

const LOT_INCLUDE = {
  product: PRODUCT_REF,
  order: { select: { id: true, code: true, quantity: true, startedAt: true, completedAt: true } },
  inspections: { include: { inspector: { select: { firstName: true, lastName: true, username: true } } }, orderBy: { inspectedAt: 'asc' as const } },
} as const;

/** Nombres de los estados en los mensajes de error (la API responde en español). */
const STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  DRAFT: 'Borrador',
  RELEASED: 'Liberada',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Terminada',
  CANCELLED: 'Cancelada',
};

type Num = { toString(): string };
const num = (v: Num | null | undefined) => (v === null || v === undefined ? 0 : decimalToNumber(v));
const fullName = (u?: { firstName?: string | null; lastName?: string | null; username?: string } | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '' : '';

/**
 * Manufactura: BOM, rutas, órdenes de producción, lotes y control de calidad.
 * Todo cambio de existencias pasa por StockService (consumo = salida; lote liberado = entrada),
 * por eso el kardex, el costo promedio y el dashboard quedan coherentes con el resto del sistema.
 */
@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly sequence: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── BOM ─────────────────────────

  async boms(productId?: string) {
    const rows = await this.prisma.bom.findMany({
      where: productId ? { productId } : {},
      include: BOM_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((b) => this.bomDto(b));
  }

  async bom(id: string) {
    const b = await this.prisma.bom.findUnique({ where: { id }, include: BOM_INCLUDE });
    if (!b) throw new NotFoundException('Lista de materiales no encontrada');
    return this.bomDto(b);
  }

  async createBom(dto: CreateBomDto, actor: AuthUser, ip?: string) {
    await this.assertProduct(dto.productId, 'productId');
    await this.assertComponents(dto.productId, dto.items);
    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const last = await tx.bom.findFirst({ where: { productId: dto.productId }, orderBy: { version: 'desc' }, select: { version: true } });
      // Una sola BOM vigente por producto: la nueva reemplaza a la anterior.
      await tx.bom.updateMany({ where: { productId: dto.productId, isActive: true }, data: { isActive: false } });
      return tx.bom.create({
        data: {
          code: await this.sequence.next(tx, 'BOM', 'LM'),
          productId: dto.productId,
          version: (last?.version ?? 0) + 1,
          notes: dto.notes || null,
          createdById: actor.id,
          items: { create: dto.items.map((i) => ({ componentId: i.componentId, quantity: i.quantity, notes: i.notes || null })) },
        },
        include: BOM_INCLUDE,
      });
    }, TX_OPTIONS);
    await this.log(actor, 'CREATE', 'Bom', created.id, `Lista de materiales ${created.code} (v${created.version}) de ${created.product.sku}`, ip);
    return this.bomDto(created);
  }

  /** Si la BOM ya se usó en órdenes se crea una versión nueva; si no, se corrige en el lugar. */
  async updateBom(id: string, dto: UpdateBomDto, actor: AuthUser, ip?: string) {
    const current = await this.prisma.bom.findUnique({ where: { id }, include: { _count: { select: { orders: true } }, product: { select: { sku: true } } } });
    if (!current) throw new NotFoundException('Lista de materiales no encontrada');
    await this.assertComponents(current.productId, dto.items);

    if (current._count.orders > 0) {
      const created = await this.createBom({ productId: current.productId, items: dto.items, notes: dto.notes ?? current.notes ?? undefined }, actor, ip);
      return { ...created, replaced: current.code };
    }
    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.bomItem.deleteMany({ where: { bomId: id } });
      return tx.bom.update({
        where: { id },
        data: {
          notes: dto.notes !== undefined ? dto.notes || null : undefined,
          items: { create: dto.items.map((i) => ({ componentId: i.componentId, quantity: i.quantity, notes: i.notes || null })) },
        },
        include: BOM_INCLUDE,
      });
    }, TX_OPTIONS);
    await this.log(actor, 'UPDATE', 'Bom', id, `Lista de materiales ${updated.code} de ${current.product.sku} modificada`, ip);
    return this.bomDto(updated);
  }

  async setBomActive(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    const b = await this.prisma.bom.findUnique({ where: { id }, select: { productId: true, code: true } });
    if (!b) throw new NotFoundException('Lista de materiales no encontrada');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (isActive) await tx.bom.updateMany({ where: { productId: b.productId, isActive: true }, data: { isActive: false } });
      await tx.bom.update({ where: { id }, data: { isActive } });
    }, TX_OPTIONS);
    await this.log(actor, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Bom', id, `Lista de materiales ${b.code} ${isActive ? 'vigente' : 'desactivada'}`, ip);
    return this.bom(id);
  }

  // ───────────────────────── Rutas ─────────────────────────

  async routes(productId?: string) {
    const rows = await this.prisma.productionRoute.findMany({
      where: productId ? { productId } : {},
      include: ROUTE_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.routeDto(r));
  }

  async route(id: string) {
    const r = await this.prisma.productionRoute.findUnique({ where: { id }, include: ROUTE_INCLUDE });
    if (!r) throw new NotFoundException('Ruta no encontrada');
    return this.routeDto(r);
  }

  async createRoute(dto: CreateRouteDto, actor: AuthUser, ip?: string) {
    await this.assertProduct(dto.productId, 'productId');
    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.productionRoute.updateMany({ where: { productId: dto.productId, isActive: true }, data: { isActive: false } });
      return tx.productionRoute.create({
        data: {
          code: await this.sequence.next(tx, 'ROUTE', 'RT'),
          productId: dto.productId,
          name: dto.name,
          operations: { create: this.operations(dto.operations) },
        },
        include: ROUTE_INCLUDE,
      });
    }, TX_OPTIONS);
    await this.log(actor, 'CREATE', 'ProductionRoute', created.id, `Ruta ${created.code} "${created.name}" de ${created.product.sku}`, ip);
    return this.routeDto(created);
  }

  /** Las órdenes guardan su propia copia de los pasos: cambiar la ruta no altera órdenes existentes. */
  async updateRoute(id: string, dto: UpdateRouteDto, actor: AuthUser, ip?: string) {
    const exists = await this.prisma.productionRoute.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Ruta no encontrada');
    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.routeOperation.deleteMany({ where: { routeId: id } });
      return tx.productionRoute.update({
        where: { id },
        data: { name: dto.name, operations: { create: this.operations(dto.operations) } },
        include: ROUTE_INCLUDE,
      });
    }, TX_OPTIONS);
    await this.log(actor, 'UPDATE', 'ProductionRoute', id, `Ruta ${updated.code} modificada`, ip);
    return this.routeDto(updated);
  }

  async setRouteActive(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    const r = await this.prisma.productionRoute.findUnique({ where: { id }, select: { productId: true, code: true } });
    if (!r) throw new NotFoundException('Ruta no encontrada');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (isActive) await tx.productionRoute.updateMany({ where: { productId: r.productId, isActive: true }, data: { isActive: false } });
      await tx.productionRoute.update({ where: { id }, data: { isActive } });
    }, TX_OPTIONS);
    await this.log(actor, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'ProductionRoute', id, `Ruta ${r.code} ${isActive ? 'vigente' : 'desactivada'}`, ip);
    return this.route(id);
  }

  // ───────────────────────── Órdenes de producción ─────────────────────────

  async orders(f: FilterProductionOrderDto) {
    const where: Prisma.ProductionOrderWhereInput = {
      ...(f.status && { status: f.status }),
      ...(f.search && {
        OR: [
          { code: { contains: f.search, mode: 'insensitive' } },
          { product: { name: { contains: f.search, mode: 'insensitive' } } },
          { product: { sku: { contains: f.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
    ]);
    return {
      data: rows.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        product: this.productRef(o.product),
        bom: o.bom,
        quantity: o.quantity,
        producedQuantity: o.producedQuantity,
        releasedQuantity: o.lots.reduce((n, l) => n + l.releasedQuantity, 0),
        scrappedQuantity: o.lots.reduce((n, l) => n + l.scrappedQuantity, 0),
        lots: o.lots.map((l) => ({ id: l.id, code: l.code, status: l.status })),
        stepsDone: o.steps.filter((s) => s.status === ProductionStepStatus.DONE).length,
        stepsTotal: o.steps.length,
        plannedStart: o.plannedStart,
        dueDate: o.dueDate,
        startedAt: o.startedAt,
        completedAt: o.completedAt,
        createdAt: o.createdAt,
      })),
      pagination: buildPagination(f.page, f.limit, total),
    };
  }

  async order(id: string) {
    const o = await this.prisma.productionOrder.findUnique({ where: { id }, include: ORDER_DETAIL_INCLUDE });
    if (!o) throw new NotFoundException('Orden de producción no encontrada');
    return {
      id: o.id,
      code: o.code,
      status: o.status,
      product: this.productRef(o.product),
      bom: o.bom,
      route: o.route,
      quantity: o.quantity,
      producedQuantity: o.producedQuantity,
      plannedStart: o.plannedStart,
      dueDate: o.dueDate,
      releasedAt: o.releasedAt,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
      cancelledAt: o.cancelledAt,
      cancellationReason: o.cancellationReason,
      cycleHours: o.startedAt && o.completedAt ? Math.round(((o.completedAt.getTime() - o.startedAt.getTime()) / 3_600_000) * 100) / 100 : null,
      materialCost: num(o.materialCost),
      notes: o.notes,
      createdBy: fullName(o.createdBy),
      createdAt: o.createdAt,
      materials: o.consumptions.map((c) => ({
        component: this.productRef(c.component),
        plannedQuantity: c.plannedQuantity,
        consumedQuantity: c.consumedQuantity,
        unitCost: num(c.unitCost),
        // Antes de iniciar: ¿alcanza lo que hay en bodega?
        available: c.component.stock,
        shortage: o.status === ProductionOrderStatus.DRAFT || o.status === ProductionOrderStatus.RELEASED ? Math.max(0, c.plannedQuantity - c.component.stock) : 0,
      })),
      steps: o.steps.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        name: s.name,
        workCenter: s.workCenter,
        standardMinutes: s.standardMinutes,
        status: s.status,
        completedAt: s.completedAt,
        completedBy: fullName(s.completedBy),
        notes: s.notes,
      })),
      lots: o.lots.map((l) => this.lotSummary(l)),
      movements: o.movements.map((m) => ({
        id: m.id,
        type: m.type,
        product: m.product,
        quantity: m.quantity,
        unitCost: num(m.unitCost),
        stockBefore: m.stockBefore,
        stockAfter: m.stockAfter,
        note: m.note,
        lotCode: m.productionLot?.code ?? null,
        createdAt: m.createdAt,
      })),
    };
  }

  async createOrder(dto: CreateProductionOrderDto, actor: AuthUser, ip?: string) {
    await this.assertProduct(dto.productId, 'productId');
    // "2026-11-02" = ese día en hora de Nicaragua (la entrega vence al final del día).
    const plannedStart = dto.plannedStart ? parseBoundary(dto.plannedStart, 'start') : null;
    const dueDate = dto.dueDate ? parseBoundary(dto.dueDate, 'end') : null;
    if (plannedStart && dueDate && dueDate < plannedStart) {
      throw new BadRequestException({ message: 'Fechas inválidas', errors: [{ field: 'dueDate', message: 'La fecha de entrega no puede ser anterior al inicio' }] });
    }
    const bom = dto.bomId
      ? await this.prisma.bom.findUnique({ where: { id: dto.bomId }, include: { items: true } })
      : await this.prisma.bom.findFirst({ where: { productId: dto.productId, isActive: true }, orderBy: { version: 'desc' }, include: { items: true } });
    if (!bom || bom.productId !== dto.productId) {
      throw new BadRequestException({ message: 'El producto no tiene lista de materiales', errors: [{ field: 'bomId', message: 'Registre la BOM del producto antes de fabricarlo' }] });
    }
    if (!bom.isActive) throw new BadRequestException({ message: 'BOM inactiva', errors: [{ field: 'bomId', message: `${bom.code} no está vigente` }] });
    const route = dto.routeId
      ? await this.prisma.productionRoute.findUnique({ where: { id: dto.routeId }, include: { operations: { orderBy: { sequence: 'asc' } } } })
      : await this.prisma.productionRoute.findFirst({ where: { productId: dto.productId, isActive: true }, orderBy: { createdAt: 'desc' }, include: { operations: { orderBy: { sequence: 'asc' } } } });
    if (dto.routeId && (!route || route.productId !== dto.productId)) {
      throw new BadRequestException({ message: 'Ruta inválida', errors: [{ field: 'routeId', message: 'La ruta no corresponde al producto' }] });
    }

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return tx.productionOrder.create({
        data: {
          code: await this.sequence.next(tx, 'PRODUCTION_ORDER', 'OP'),
          productId: dto.productId,
          bomId: bom.id,
          routeId: route?.id ?? null,
          quantity: dto.quantity,
          plannedStart,
          dueDate,
          notes: dto.notes || null,
          createdById: actor.id,
          consumptions: { create: materialPlan(bom.items, dto.quantity) },
          steps: {
            create: (route?.operations ?? []).map((op) => ({
              sequence: op.sequence,
              name: op.name,
              workCenter: op.workCenter,
              standardMinutes: op.standardMinutes,
            })),
          },
        },
        select: { id: true, code: true },
      });
    }, TX_OPTIONS);
    await this.log(actor, 'CREATE', 'ProductionOrder', created.id, `Orden de producción ${created.code}: ${dto.quantity} u.`, ip);
    return this.order(created.id);
  }

  async release(id: string, actor: AuthUser, ip?: string) {
    const o = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockedOrder(tx, id);
      this.assertMove(current.status, ProductionOrderStatus.RELEASED);
      return tx.productionOrder.update({ where: { id }, data: { status: ProductionOrderStatus.RELEASED, releasedAt: new Date() }, select: { code: true } });
    }, TX_OPTIONS);
    await this.log(actor, 'RELEASE', 'ProductionOrder', id, `Orden ${o.code} liberada a producción`, ip);
    return this.order(id);
  }

  /** Inicia la OP: consume (saca del inventario) los materiales de la BOM al costo promedio vigente. */
  async start(id: string, actor: AuthUser, ip?: string) {
    const o = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockedOrder(tx, id);
      this.assertMove(current.status, ProductionOrderStatus.IN_PROGRESS);
      const lines = await tx.productionConsumption.findMany({ where: { orderId: id }, orderBy: { id: 'asc' } });
      const results = await this.stock.registerExits(
        tx,
        lines.map((l) => ({ productId: l.componentId, quantity: l.plannedQuantity })),
        { userId: actor.id, reference: current.code, note: `Consumo de materiales de ${current.code}`, productionOrderId: id },
        'materials',
      );
      let cost = new Decimal(0);
      for (let i = 0; i < lines.length; i++) {
        const unitCost = new Decimal(results[i].movement.unitCost.toString());
        cost = cost.plus(unitCost.times(lines[i].plannedQuantity));
        await tx.productionConsumption.update({ where: { id: lines[i].id }, data: { consumedQuantity: lines[i].plannedQuantity, unitCost: fixed4(unitCost) } });
      }
      return tx.productionOrder.update({
        where: { id },
        data: { status: ProductionOrderStatus.IN_PROGRESS, startedAt: new Date(), materialCost: fixed2(cost) },
        select: { code: true, materialCost: true },
      });
    }, TX_OPTIONS);
    await this.log(actor, 'START', 'ProductionOrder', id, `Orden ${o.code} iniciada: materiales consumidos por C$ ${o.materialCost.toString()}`, ip);
    return this.order(id);
  }

  async completeStep(id: string, stepId: string, dto: CompleteStepDto, actor: AuthUser, ip?: string) {
    const step = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockedOrder(tx, id);
      if (current.status !== ProductionOrderStatus.IN_PROGRESS) {
        throw new ConflictException('Los pasos se registran con la orden en proceso');
      }
      const steps = await tx.productionOrderStep.findMany({ where: { orderId: id }, orderBy: { sequence: 'asc' } });
      const target = steps.find((s) => s.id === stepId);
      if (!target) throw new NotFoundException('Paso no encontrado en esta orden');
      if (target.status === ProductionStepStatus.DONE) throw new ConflictException(`El paso "${target.name}" ya está hecho`);
      const previous = steps.find((s) => s.sequence < target.sequence && s.status !== ProductionStepStatus.DONE);
      if (previous) throw new ConflictException(`Complete primero el paso ${previous.sequence}: ${previous.name}`);
      await tx.productionOrderStep.update({
        where: { id: stepId },
        data: { status: ProductionStepStatus.DONE, completedAt: new Date(), completedById: actor.id, notes: dto.notes || null },
      });
      return { name: target.name, code: current.code };
    }, TX_OPTIONS);
    await this.log(actor, 'STEP', 'ProductionOrder', id, `${step.code}: paso "${step.name}" completado`, ip);
    return this.order(id);
  }

  /** Termina la OP: las unidades buenas forman un lote que espera inspección de calidad. */
  async complete(id: string, dto: CompleteProductionOrderDto, actor: AuthUser, ip?: string) {
    const res = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockedOrder(tx, id);
      this.assertMove(current.status, ProductionOrderStatus.COMPLETED);
      if (dto.producedQuantity > current.quantity) {
        throw new BadRequestException({
          message: 'Cantidad producida inválida',
          errors: [{ field: 'producedQuantity', message: `No puede superar lo planificado (${current.quantity})` }],
        });
      }
      const pending = await tx.productionOrderStep.findMany({ where: { orderId: id, status: ProductionStepStatus.PENDING }, orderBy: { sequence: 'asc' } });
      if (pending.length) {
        throw new ConflictException({
          message: 'Faltan pasos de la ruta',
          errors: pending.map((s) => ({ field: 'steps', message: `Paso ${s.sequence} pendiente: ${s.name}` })),
        });
      }
      let lotCode: string | null = null;
      if (dto.producedQuantity > 0) {
        const lot = await tx.productionLot.create({
          data: {
            code: await this.sequence.next(tx, 'LOT', 'LOT'),
            orderId: id,
            productId: current.productId,
            quantity: dto.producedQuantity,
            pendingQuantity: dto.producedQuantity,
            unitCost: fixed4(unitCostOf(num(current.materialCost), dto.producedQuantity)),
          },
          select: { code: true },
        });
        lotCode = lot.code;
      }
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.COMPLETED,
          completedAt: new Date(),
          producedQuantity: dto.producedQuantity,
          ...(dto.notes && { notes: current.notes ? `${current.notes}\n${dto.notes}` : dto.notes }),
        },
      });
      return { code: current.code, lotCode, planned: current.quantity };
    }, TX_OPTIONS);
    await this.log(
      actor,
      'COMPLETE',
      'ProductionOrder',
      id,
      `Orden ${res.code} terminada: ${dto.producedQuantity} de ${res.planned} u.${res.lotCode ? ` en el lote ${res.lotCode} (pendiente de calidad)` : ''}`,
      ip,
    );
    return this.order(id);
  }

  async cancel(id: string, dto: CancelProductionOrderDto, actor: AuthUser, ip?: string) {
    const o = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockedOrder(tx, id);
      this.assertMove(current.status, ProductionOrderStatus.CANCELLED);
      return tx.productionOrder.update({
        where: { id },
        data: { status: ProductionOrderStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.reason },
        select: { code: true },
      });
    }, TX_OPTIONS);
    await this.log(actor, 'CANCEL', 'ProductionOrder', id, `Orden ${o.code} cancelada: ${dto.reason}`, ip);
    return this.order(id);
  }

  // ───────────────────────── Lotes y calidad ─────────────────────────

  async lots(f: FilterLotDto) {
    const where: Prisma.ProductionLotWhereInput = {
      ...(f.status && { status: f.status }),
      ...(f.search && {
        OR: [
          { code: { contains: f.search, mode: 'insensitive' } },
          { order: { code: { contains: f.search, mode: 'insensitive' } } },
          { product: { name: { contains: f.search, mode: 'insensitive' } } },
          { product: { sku: { contains: f.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productionLot.count({ where }),
      this.prisma.productionLot.findMany({ where, include: LOT_INCLUDE, orderBy: [{ producedAt: 'desc' }, { id: 'desc' }], skip: (f.page - 1) * f.limit, take: f.limit }),
    ]);
    return { data: rows.map((l) => this.lotDto(l)), pagination: buildPagination(f.page, f.limit, total) };
  }

  async lot(id: string) {
    const l = await this.prisma.productionLot.findUnique({ where: { id }, include: LOT_INCLUDE });
    if (!l) throw new NotFoundException('Lote no encontrado');
    return this.lotDto(l);
  }

  /**
   * Inspección de calidad: las conformes entran al inventario; las no conformes se desechan
   * (SCRAP), vuelven a inspección tras el retrabajo (REWORK) o se liberan por concesión (RELEASE).
   */
  async inspect(lotId: string, dto: InspectLotDto, actor: AuthUser, ip?: string) {
    const res = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockProductionLot(tx, lotId);
      const lot = await tx.productionLot.findUnique({ where: { id: lotId } });
      if (!lot) throw new NotFoundException('Lote no encontrado');

      let outcome: ReturnType<typeof applyInspection>;
      try {
        outcome = applyInspection(lot, dto.defectiveQuantity, dto.disposition ?? null);
      } catch (e) {
        throw new BadRequestException({ message: 'Inspección inválida', errors: [{ field: 'defectiveQuantity', message: (e as Error).message }] });
      }
      const defective = dto.defectiveQuantity;
      const qc = await tx.qualityInspection.create({
        data: {
          code: await this.sequence.next(tx, 'QUALITY_INSPECTION', 'QC'),
          lotId,
          stage: outcome.stage === 'INITIAL' ? InspectionStage.INITIAL : InspectionStage.REWORK,
          inspectedQuantity: outcome.inspected,
          defectiveQuantity: defective,
          result: defective > 0 ? InspectionResult.NONCONFORMING : InspectionResult.CONFORMING,
          disposition: defective > 0 ? dto.disposition : null,
          defectDescription: dto.defectDescription || null,
          notes: dto.notes || null,
          inspectorId: actor.id,
        },
        select: { code: true },
      });
      await tx.productionLot.update({
        where: { id: lotId },
        data: {
          pendingQuantity: outcome.lot.pendingQuantity,
          reworkQuantity: outcome.lot.reworkQuantity,
          releasedQuantity: outcome.lot.releasedQuantity,
          scrappedQuantity: outcome.lot.scrappedQuantity,
          status: lotStatus(outcome.lot),
        },
      });
      if (outcome.toStock > 0) {
        await this.stock.registerEntry(tx, {
          productId: lot.productId,
          quantity: outcome.toStock,
          unitCost: lot.unitCost.toString(),
          userId: actor.id,
          reference: lot.code,
          note: `Lote ${lot.code} liberado por calidad (${qc.code})${dto.disposition === 'RELEASE' && defective > 0 ? ', incluye concesión' : ''}`,
          productionOrderId: lot.orderId,
          productionLotId: lot.id,
        });
      }
      return { qc: qc.code, lot: lot.code, inspected: outcome.inspected, toStock: outcome.toStock };
    }, TX_OPTIONS);
    await this.log(
      actor,
      'INSPECT',
      'ProductionLot',
      lotId,
      `${res.qc} sobre ${res.lot}: ${res.inspected} inspeccionadas, ${dto.defectiveQuantity} no conformes${dto.disposition && dto.defectiveQuantity ? ` (${dto.disposition})` : ''}; ${res.toStock} entran al inventario`,
      ip,
    );
    return this.lot(lotId);
  }

  // ───────────────────────── helpers ─────────────────────────

  private async lockedOrder(tx: Prisma.TransactionClient, id: string) {
    await lockProductionOrder(tx, id);
    const o = await tx.productionOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Orden de producción no encontrada');
    return o;
  }

  private assertMove(from: ProductionOrderStatus, to: ProductionOrderStatus) {
    if (!canMoveOrder(from, to)) {
      throw new ConflictException(`No se puede pasar una orden «${STATUS_LABEL[from]}» a «${STATUS_LABEL[to]}»`);
    }
  }

  private async assertProduct(productId: string, field: string) {
    const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { isActive: true } });
    if (!p) throw new BadRequestException({ message: 'Producto inválido', errors: [{ field, message: 'El producto no existe' }] });
    if (!p.isActive) throw new BadRequestException({ message: 'Producto inactivo', errors: [{ field, message: 'El producto está inactivo' }] });
  }

  private async assertComponents(productId: string, items: BomItemDto[]) {
    const errors: { field: string; message: string }[] = [];
    const seen = new Set<string>();
    items.forEach((i, idx) => {
      if (i.componentId === productId) errors.push({ field: `items[${idx}].componentId`, message: 'Un producto no puede ser componente de sí mismo' });
      if (seen.has(i.componentId)) errors.push({ field: `items[${idx}].componentId`, message: 'Componente repetido' });
      seen.add(i.componentId);
    });
    const found = await this.prisma.product.findMany({ where: { id: { in: [...seen] } }, select: { id: true, isActive: true, sku: true } });
    items.forEach((i, idx) => {
      const p = found.find((x) => x.id === i.componentId);
      if (!p) errors.push({ field: `items[${idx}].componentId`, message: 'El componente no existe' });
      else if (!p.isActive) errors.push({ field: `items[${idx}].componentId`, message: `${p.sku} está inactivo` });
    });
    if (errors.length) throw new BadRequestException({ message: 'Lista de materiales inválida', errors });
  }

  private operations(ops: RouteOperationDto[]) {
    return ops.map((op, i) => ({
      sequence: (i + 1) * 10,
      name: op.name,
      workCenter: op.workCenter || null,
      standardMinutes: op.standardMinutes,
      instructions: op.instructions || null,
    }));
  }

  private productRef(p: { id: string; sku: string; name: string; unit: string; stock: number; avgCost: Num; isActive: boolean }) {
    return { id: p.id, sku: p.sku, name: p.name, unit: p.unit, stock: p.stock, avgCost: num(p.avgCost), isActive: p.isActive };
  }

  private bomDto(b: Prisma.BomGetPayload<{ include: typeof BOM_INCLUDE }>) {
    const items = b.items.map((i) => ({
      id: i.id,
      component: this.productRef(i.component),
      quantity: i.quantity,
      notes: i.notes,
      lineCost: Math.round(num(i.component.avgCost) * i.quantity * 100) / 100,
    }));
    return {
      id: b.id,
      code: b.code,
      version: b.version,
      isActive: b.isActive,
      notes: b.notes,
      product: this.productRef(b.product),
      items,
      // Costo estándar de materiales por unidad, con los costos promedio actuales.
      unitMaterialCost: Math.round(items.reduce((t, i) => t + i.lineCost, 0) * 100) / 100,
      ordersCount: b._count.orders,
      createdAt: b.createdAt,
    };
  }

  private routeDto(r: Prisma.ProductionRouteGetPayload<{ include: typeof ROUTE_INCLUDE }>) {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      product: this.productRef(r.product),
      operations: r.operations.map((o) => ({ id: o.id, sequence: o.sequence, name: o.name, workCenter: o.workCenter, standardMinutes: o.standardMinutes, instructions: o.instructions })),
      standardMinutesPerUnit: r.operations.reduce((t, o) => t + o.standardMinutes, 0),
      ordersCount: r._count.orders,
      createdAt: r.createdAt,
    };
  }

  private lotSummary(l: {
    id: string;
    code: string;
    status: string;
    quantity: number;
    pendingQuantity: number;
    reworkQuantity: number;
    releasedQuantity: number;
    scrappedQuantity: number;
    unitCost: Num;
    producedAt: Date;
    inspections: Array<{
      id: string;
      code: string;
      stage: string;
      inspectedQuantity: number;
      defectiveQuantity: number;
      result: string;
      disposition: string | null;
      defectDescription: string | null;
      notes: string | null;
      inspectedAt: Date;
      inspector: { firstName?: string | null; lastName?: string | null; username?: string };
    }>;
  }) {
    return {
      id: l.id,
      code: l.code,
      status: l.status,
      quantity: l.quantity,
      pendingQuantity: l.pendingQuantity,
      reworkQuantity: l.reworkQuantity,
      releasedQuantity: l.releasedQuantity,
      scrappedQuantity: l.scrappedQuantity,
      unitCost: num(l.unitCost),
      producedAt: l.producedAt,
      inspections: l.inspections.map((i) => ({
        id: i.id,
        code: i.code,
        stage: i.stage,
        inspectedQuantity: i.inspectedQuantity,
        defectiveQuantity: i.defectiveQuantity,
        result: i.result,
        disposition: i.disposition,
        defectDescription: i.defectDescription,
        notes: i.notes,
        inspectedAt: i.inspectedAt,
        inspector: fullName(i.inspector),
      })),
    };
  }

  private lotDto(l: Prisma.ProductionLotGetPayload<{ include: typeof LOT_INCLUDE }>) {
    return { ...this.lotSummary(l), product: this.productRef(l.product), order: l.order };
  }

  private log(actor: AuthUser, action: string, entity: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({ userId: actor.id, username: actor.username, module: 'production', action, entity, entityId, description, ip });
  }
}
