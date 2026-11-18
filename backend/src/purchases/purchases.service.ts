import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MAIN_WAREHOUSE_ID } from '../common/constants/locations';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { addDays, dateRange, parseBoundary } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockPurchase, TX_OPTIONS } from '../common/utils/locks';
import { Decimal, fixed2, fixed4, money } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { Currency, Prisma, PurchaseStatus } from '../generated/prisma/client';
import { rememberSupplierCost } from '../inventory/product-suppliers';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { ts } from '../reports/report-sql';
import {
  CancelPurchaseDto,
  CreatePurchaseDto,
  FilterPurchaseDto,
  PurchaseItemDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';
import { landedUnitCost, purchaseLineSubtotal } from './landed-cost';
import { canMovePurchase, canReceive } from './purchase-status';

type Dec = { toString(): string };
type FieldError = { field: string; message: string };

const SUPPLIER_SELECT = { select: { id: true, name: true, isInternational: true, country: true } } as const;
const USER_SELECT = { select: { id: true, username: true, firstName: true, lastName: true } } as const;

const LIST_INCLUDE = {
  supplier: SUPPLIER_SELECT,
  createdBy: USER_SELECT,
  items: { select: { quantity: true, receivedQuantity: true } },
  _count: { select: { receipts: true } },
} as const;

const DETAIL_INCLUDE = {
  supplier: SUPPLIER_SELECT,
  createdBy: USER_SELECT,
  items: { include: { product: { select: { sku: true, name: true, stock: true } } }, orderBy: { id: 'asc' as const } },
  receipts: {
    orderBy: { receivedAt: 'asc' as const },
    include: {
      receivedBy: { select: { id: true, username: true } },
      location: { select: { id: true, code: true, name: true } },
      items: {
        orderBy: { id: 'asc' as const },
        include: {
          purchaseItem: { select: { productId: true, product: { select: { sku: true, name: true } } } },
          movement: { select: { id: true, stockBefore: true, stockAfter: true } },
        },
      },
    },
  },
} as const;

interface ItemRow {
  id: string;
  productId: string;
  quantity: number;
  unitCost: Dec;
  subtotal: Dec;
  receivedQuantity: number;
  product: { sku: string; name: string; stock: number };
}

interface ReceiptRow {
  id: string;
  code: string;
  receivedAt: Date;
  notes: string | null;
  receivedBy: { id: string; username: string };
  location: { id: number; code: string; name: string };
  items: {
    id: string;
    purchaseItemId: string;
    quantity: number;
    unitCost: Dec;
    purchaseItem: { productId: string; product: { sku: string; name: string } };
    movement: { id: string; stockBefore: number; stockAfter: number } | null;
  }[];
}

interface PurchaseRow {
  id: string;
  code: string;
  supplierId: string;
  status: PurchaseStatus;
  currency: Currency;
  exchangeRate: Dec;
  orderedAt: Date | null;
  expectedAt: Date | null;
  subtotal: Dec;
  additionalCosts: Dec;
  total: Dec;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: { id: string; name: string; isInternational: boolean; country: string | null };
  createdBy: { id: string; username: string; firstName: string; lastName: string };
  items: (Partial<ItemRow> & { quantity: number; receivedQuantity: number })[];
  receipts?: ReceiptRow[];
  _count?: { receipts: number };
}

interface PreparedLine {
  productId: string;
  sku: string;
  quantity: number;
  unitCost: Decimal;
  subtotal: Decimal;
}

const STATUS_LABEL: Record<PurchaseStatus, string> = {
  DRAFT: 'borrador',
  ORDERED: 'ordenada',
  PARTIALLY_RECEIVED: 'parcialmente recibida',
  RECEIVED: 'recibida',
  CANCELLED: 'cancelada',
};

/**
 * Compras y recepción (mejora n.° 41 y 48 del análisis UX).
 *
 * Flujo: Borrador → Ordenada → Recepción (total o parcial) → Recibida.
 * Cada línea recibida genera, en la MISMA transacción, una ENTRADA de inventario enlazada 1:1
 * (inventory_movements.purchase_receipt_item_id) con el costo puesto en bodega en córdobas;
 * así el costo promedio sale de lo que realmente se compró.
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly sequence: DocumentSequenceService,
  ) {}

  // ───────────────────────── consultas ─────────────────────────

  async findAll(f: FilterPurchaseDto) {
    const { page, limit } = f;
    const range = dateRange(f.from, f.to);
    const where: Prisma.PurchaseWhereInput = {
      ...(f.status && { status: f.status }),
      ...(f.supplierId && { supplierId: f.supplierId }),
      ...(f.productId && { items: { some: { productId: f.productId } } }),
      ...(range && { createdAt: range }),
      ...(f.search && {
        OR: [
          { code: { contains: f.search, mode: 'insensitive' as const } },
          { supplier: { name: { contains: f.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const since = addDays(new Date(), -30);
    const [total, rows, groups, ordered] = await this.prisma.$transaction([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchase.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(total * exchange_rate), 0)::text AS amount, COUNT(*)::int AS purchases
        FROM purchases WHERE status <> 'DRAFT' AND status <> 'CANCELLED' AND ordered_at >= ${ts(since)}`),
    ]);
    const byStatus: Record<PurchaseStatus, number> = { DRAFT: 0, ORDERED: 0, PARTIALLY_RECEIVED: 0, RECEIVED: 0, CANCELLED: 0 };
    for (const g of groups as unknown as { status: PurchaseStatus; _count: { _all: number } }[]) byStatus[g.status] = g._count._all;
    const last30 = (ordered as { amount: string; purchases: number }[])[0];
    return {
      data: (rows as unknown as PurchaseRow[]).map((p) => this.toDto(p)),
      pagination: buildPagination(page, limit, total),
      summary: {
        byStatus,
        pendingReceipt: byStatus.ORDERED + byStatus.PARTIALLY_RECEIVED,
        // En córdobas (total × tipo de cambio), sin borradores ni canceladas.
        orderedLast30Days: { amount: money(last30?.amount ?? 0).toNumber(), purchases: last30?.purchases ?? 0 },
      },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.purchase.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException('Compra no encontrada');
    return this.toDto(row as unknown as PurchaseRow);
  }

  // ───────────────────────── creación y edición ─────────────────────────

  async create(dto: CreatePurchaseDto, actor: AuthUser, ip?: string) {
    const currency = dto.currency ?? Currency.NIO;
    const rate = this.resolveRate(currency, dto.exchangeRate);
    const extra = money(dto.additionalCosts ?? 0);
    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.assertSupplier(tx, dto.supplierId);
      const lines = await this.prepareLines(tx, dto.items);
      const subtotal = money(lines.reduce((acc, l) => acc.plus(l.subtotal), new Decimal(0)));
      const code = await this.sequence.next(tx, 'PURCHASE', 'OC');
      return tx.purchase.create({
        data: {
          code,
          supplierId: dto.supplierId,
          status: dto.order ? PurchaseStatus.ORDERED : PurchaseStatus.DRAFT,
          currency,
          exchangeRate: rate.toFixed(6),
          orderedAt: dto.order ? new Date() : null,
          expectedAt: dto.expectedAt ? parseBoundary(dto.expectedAt, 'start') : null,
          subtotal: fixed2(subtotal),
          additionalCosts: fixed2(extra),
          total: fixed2(subtotal.plus(extra)),
          notes: dto.notes || null,
          createdById: actor.id,
          items: { create: lines.map((l) => this.lineData(l)) },
        },
        include: DETAIL_INCLUDE,
      });
    }, TX_OPTIONS)) as unknown as PurchaseRow;

    await this.log(actor, 'CREATE', created, `Compra ${created.code} a ${created.supplier.name} (${STATUS_LABEL[created.status]}) por ${this.amountText(created)}`, ip);
    return this.toDto(created);
  }

  async update(id: string, dto: UpdatePurchaseDto, actor: AuthUser, ip?: string) {
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockAndRead(tx, id);
      const changesTerms = ['supplierId', 'currency', 'exchangeRate', 'additionalCosts', 'items'].some(
        (k) => dto[k as keyof UpdatePurchaseDto] !== undefined,
      );

      if (current.status !== PurchaseStatus.DRAFT) {
        if (current.status === PurchaseStatus.RECEIVED || current.status === PurchaseStatus.CANCELLED) {
          throw new ConflictException(`Una compra ${STATUS_LABEL[current.status]} ya no se puede modificar`);
        }
        if (changesTerms) {
          throw new ConflictException('La compra ya fue ordenada: solo se pueden cambiar la fecha esperada y las notas');
        }
      }

      const data: Prisma.PurchaseUpdateInput = {};
      if (dto.expectedAt !== undefined) data.expectedAt = dto.expectedAt ? parseBoundary(dto.expectedAt, 'start') : null;
      if (dto.notes !== undefined) data.notes = dto.notes;

      if (changesTerms) {
        if (dto.supplierId !== undefined) {
          await this.assertSupplier(tx, dto.supplierId);
          data.supplier = { connect: { id: dto.supplierId } };
        }
        const currency = dto.currency ?? current.currency;
        const rate = this.resolveRate(
          currency,
          dto.exchangeRate ?? (currency === current.currency ? Number(current.exchangeRate.toString()) : undefined),
        );
        data.currency = currency;
        data.exchangeRate = rate.toFixed(6);

        let subtotal = new Decimal(current.subtotal.toString());
        if (dto.items !== undefined) {
          const lines = await this.prepareLines(tx, dto.items);
          subtotal = money(lines.reduce((acc, l) => acc.plus(l.subtotal), new Decimal(0)));
          await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
          data.items = { create: lines.map((l) => this.lineData(l)) };
        }
        const extra = money(dto.additionalCosts ?? current.additionalCosts.toString());
        data.subtotal = fixed2(subtotal);
        data.additionalCosts = fixed2(extra);
        data.total = fixed2(subtotal.plus(extra));
      }
      return tx.purchase.update({ where: { id }, data, include: DETAIL_INCLUDE });
    }, TX_OPTIONS)) as unknown as PurchaseRow;

    await this.log(actor, 'UPDATE', updated, `Compra ${updated.code} modificada`, ip);
    return this.toDto(updated);
  }

  /** BORRADOR → ORDENADA: queda pendiente de recibir. */
  async order(id: string, actor: AuthUser, ip?: string) {
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockAndRead(tx, id);
      this.assertTransition(current.status, PurchaseStatus.ORDERED);
      await this.assertSupplier(tx, current.supplierId);
      return tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.ORDERED, orderedAt: new Date() },
        include: DETAIL_INCLUDE,
      });
    }, TX_OPTIONS)) as unknown as PurchaseRow;

    await this.log(actor, 'ORDER', updated, `Compra ${updated.code} ordenada a ${updated.supplier.name} por ${this.amountText(updated)}`, ip);
    return this.toDto(updated);
  }

  /** Cancela la compra (o lo que falte por recibir). Lo ya recibido permanece en inventario. */
  async cancel(id: string, dto: CancelPurchaseDto, actor: AuthUser, ip?: string) {
    let hadReceipts = false;
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockAndRead(tx, id);
      this.assertTransition(current.status, PurchaseStatus.CANCELLED);
      hadReceipts = current.status === PurchaseStatus.PARTIALLY_RECEIVED;
      return tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.reason },
        include: DETAIL_INCLUDE,
      });
    }, TX_OPTIONS)) as unknown as PurchaseRow;

    const scope = hadReceipts ? ' (se cancela lo pendiente; lo recibido se conserva)' : '';
    await this.log(actor, 'CANCEL', updated, `Compra ${updated.code} cancelada${scope}: ${dto.reason}`, ip);
    return this.toDto(updated);
  }

  /** Solo BORRADOR: una compra ya ordenada se cancela, no se borra. */
  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const code = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await this.lockAndRead(tx, id);
      if (current.status !== PurchaseStatus.DRAFT) {
        throw new ConflictException('Solo se pueden eliminar borradores; una compra ordenada se cancela');
      }
      await tx.purchase.delete({ where: { id } });
      return current.code;
    }, TX_OPTIONS);
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'purchases',
      action: 'DELETE',
      entity: 'Purchase',
      entityId: id,
      description: `Borrador ${code} eliminado`,
      ip,
    });
  }

  // ───────────────────────── recepción ─────────────────────────

  /**
   * Registra la mercadería que llegó (total o parcial). En una sola transacción:
   *  1. bloquea la compra y valida que cada cantidad no supere lo pendiente;
   *  2. crea la recepción REC-000001 con el costo unitario puesto en bodega (C$, con gastos);
   *  3. por cada línea registra una ENTRADA de inventario enlazada a la línea recibida
   *     (recalcula el costo promedio ponderado);
   *  4. actualiza lo recibido, el estado de la compra y el último costo del proveedor.
   */
  async receive(id: string, dto: ReceivePurchaseDto, actor: AuthUser, ip?: string) {
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const purchase = await this.lockAndRead(tx, id);
      if (!canReceive(purchase.status)) {
        throw new ConflictException(
          purchase.status === PurchaseStatus.DRAFT
            ? 'Confirme la orden antes de registrar la recepción'
            : `Una compra ${STATUS_LABEL[purchase.status]} no admite más recepciones`,
        );
      }

      const items = purchase.items as (ItemRow & { purchaseId?: string })[];
      const byId = new Map(items.map((i) => [i.id, i]));
      const errors: FieldError[] = [];
      const seen = new Set<string>();
      dto.items.forEach((line, i) => {
        const item = byId.get(line.purchaseItemId);
        if (!item) return void errors.push({ field: `items[${i}].purchaseItemId`, message: 'La línea no pertenece a esta compra' });
        if (seen.has(item.id)) return void errors.push({ field: `items[${i}].purchaseItemId`, message: 'Línea repetida: sume las cantidades' });
        seen.add(item.id);
        const pending = item.quantity - item.receivedQuantity;
        if (line.quantity > pending) {
          errors.push({
            field: `items[${i}].quantity`,
            message: `${item.product.sku}: pendiente ${pending}, recibido ${line.quantity}`,
          });
        }
      });
      if (errors.length) throw new BadRequestException({ message: 'Recepción inválida', errors });

      // Costo puesto en bodega en C$ (con gastos prorrateados): el que entra al costo promedio.
      const totalUnits = items.reduce((n, i) => n + i.quantity, 0);
      const costParams = {
        subtotal: purchase.subtotal.toString(),
        totalUnits,
        additionalCosts: purchase.additionalCosts.toString(),
        exchangeRate: purchase.exchangeRate.toString(),
      };
      const lines = dto.items.map((line) => {
        const item = byId.get(line.purchaseItemId)!;
        return {
          item,
          quantity: line.quantity,
          landed: landedUnitCost({ unitCost: item.unitCost.toString(), ...costParams }),
        };
      });

      const code = await this.sequence.next(tx, 'RECEIPT', 'REC');
      const receipt = (await tx.purchaseReceipt.create({
        data: {
          code,
          purchaseId: id,
          locationId: dto.locationId ?? MAIN_WAREHOUSE_ID,
          receivedById: actor.id,
          notes: dto.notes || null,
          items: {
            create: lines.map((l) => ({ purchaseItemId: l.item.id, quantity: l.quantity, unitCost: fixed4(l.landed) })),
          },
        },
        include: { items: { select: { id: true, purchaseItemId: true } } },
      })) as { id: string; items: { id: string; purchaseItemId: string }[] };
      const receiptItemId = new Map(receipt.items.map((r) => [r.purchaseItemId, r.id]));

      // Productos bloqueados en orden de id antes de mover stock (evita interbloqueos con ventas).
      await this.stock.lockProducts(tx, lines.map((l) => l.item.productId));
      for (const l of lines) {
        await this.stock.registerEntry(tx, {
          productId: l.item.productId,
          quantity: l.quantity,
          unitCost: l.landed,
          userId: actor.id,
          supplierId: purchase.supplierId,
          reference: purchase.code,
          note: `Recepción ${code}`,
          locationId: dto.locationId ?? MAIN_WAREHOUSE_ID,
          purchaseReceiptItemId: receiptItemId.get(l.item.id),
        });
        await tx.purchaseItem.update({ where: { id: l.item.id }, data: { receivedQuantity: { increment: l.quantity } } });
        await rememberSupplierCost(tx, {
          productId: l.item.productId,
          supplierId: purchase.supplierId,
          unitCost: l.item.unitCost.toString(),
          currency: purchase.currency,
        });
      }

      const received = new Map(lines.map((l) => [l.item.id, l.quantity]));
      const complete = items.every((i) => i.receivedQuantity + (received.get(i.id) ?? 0) >= i.quantity);
      const status = complete ? PurchaseStatus.RECEIVED : PurchaseStatus.PARTIALLY_RECEIVED;
      await tx.purchase.update({ where: { id }, data: { status } });

      return {
        receiptId: receipt.id,
        receiptCode: code,
        purchaseCode: purchase.code,
        supplierName: purchase.supplier.name,
        status,
        units: lines.reduce((n, l) => n + l.quantity, 0),
        lines: lines.length,
      };
    }, TX_OPTIONS);

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'purchases',
      action: 'RECEIVE',
      entity: 'Purchase',
      entityId: id,
      description: `Recepción ${result.receiptCode} de ${result.purchaseCode} (${result.supplierName}): ${result.units} u. en ${result.lines} línea(s) · ${STATUS_LABEL[result.status]}`,
      ip,
      metadata: { receiptId: result.receiptId, receiptCode: result.receiptCode, units: result.units },
    });
    const purchase = await this.findOne(id);
    return { ...purchase, lastReceipt: { id: result.receiptId, code: result.receiptCode } };
  }

  // ───────────────────────── helpers ─────────────────────────

  private async lockAndRead(tx: Prisma.TransactionClient, id: string): Promise<PurchaseRow> {
    await lockPurchase(tx, id);
    const row = await tx.purchase.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException('Compra no encontrada');
    return row as unknown as PurchaseRow;
  }

  private assertTransition(from: PurchaseStatus, to: PurchaseStatus) {
    if (!canMovePurchase(from, to)) {
      throw new ConflictException(`No se puede pasar una compra ${STATUS_LABEL[from]} a ${STATUS_LABEL[to]}`);
    }
  }

  /** En córdobas el tipo de cambio es 1 (CHECK de la BD); en dólares es obligatorio. */
  private resolveRate(currency: Currency, rate?: number): Decimal {
    if (currency === Currency.NIO) {
      if (rate !== undefined && rate !== 1) throw this.fieldError('exchangeRate', 'En córdobas el tipo de cambio es 1');
      return new Decimal(1);
    }
    if (rate === undefined) throw this.fieldError('exchangeRate', 'Indique el tipo de cambio (C$ por US$)');
    return new Decimal(rate).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
  }

  private async assertSupplier(tx: Prisma.TransactionClient, supplierId: string) {
    const s = await tx.supplier.findUnique({ where: { id: supplierId }, select: { isActive: true } });
    if (!s) throw this.fieldError('supplierId', 'El proveedor no existe');
    if (!s.isActive) throw this.fieldError('supplierId', 'El proveedor está inactivo');
  }

  /** Productos existentes y activos, sin repetir (una línea por producto, igual que la BD). */
  private async prepareLines(tx: Prisma.TransactionClient, items: PurchaseItemDto[]): Promise<PreparedLine[]> {
    const errors: FieldError[] = [];
    const seen = new Set<string>();
    items.forEach((it, i) => {
      if (seen.has(it.productId)) errors.push({ field: `items[${i}].productId`, message: 'Producto repetido: sume las cantidades en una sola línea' });
      seen.add(it.productId);
    });
    if (errors.length) throw new BadRequestException({ message: 'Datos de compra inválidos', errors });

    const products = (await tx.product.findMany({
      where: { id: { in: [...seen] } },
      select: { id: true, sku: true, isActive: true },
    })) as { id: string; sku: string; isActive: boolean }[];
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = items.map((it, i) => {
      const p = byId.get(it.productId);
      if (!p) return void errors.push({ field: `items[${i}].productId`, message: 'El producto no existe' });
      if (!p.isActive) return void errors.push({ field: `items[${i}].productId`, message: `El producto ${p.sku} está inactivo` });
      const unitCost = new Decimal(it.unitCost);
      return { productId: p.id, sku: p.sku, quantity: it.quantity, unitCost, subtotal: purchaseLineSubtotal(it.quantity, unitCost) };
    });
    if (errors.length) throw new BadRequestException({ message: 'Datos de compra inválidos', errors });
    return lines as PreparedLine[];
  }

  private lineData(l: PreparedLine) {
    return { productId: l.productId, quantity: l.quantity, unitCost: fixed4(l.unitCost), subtotal: fixed2(l.subtotal) };
  }

  private fieldError(field: string, message: string) {
    return new BadRequestException({ message: 'Datos de compra inválidos', errors: [{ field, message }] });
  }

  private amountText(p: PurchaseRow): string {
    return `${p.currency === Currency.USD ? 'US$' : 'C$'} ${new Decimal(p.total.toString()).toFixed(2)}`;
  }

  private toDto(p: PurchaseRow) {
    const rate = p.exchangeRate.toString();
    const totalUnits = p.items.reduce((n, i) => n + i.quantity, 0);
    const received = p.items.reduce((n, i) => n + i.receivedQuantity, 0);
    const costParams = { subtotal: p.subtotal.toString(), totalUnits, additionalCosts: p.additionalCosts.toString(), exchangeRate: rate };
    const detailed = p.items.length > 0 && p.items[0].id !== undefined;
    return {
      id: p.id,
      code: p.code,
      status: p.status,
      supplier: p.supplier,
      createdBy: p.createdBy,
      currency: p.currency,
      exchangeRate: decimalToNumber(p.exchangeRate),
      orderedAt: p.orderedAt,
      expectedAt: p.expectedAt,
      subtotal: decimalToNumber(p.subtotal),
      additionalCosts: decimalToNumber(p.additionalCosts),
      total: decimalToNumber(p.total),
      /** Total convertido a córdobas. */
      totalNio: money(new Decimal(p.total.toString()).times(rate)).toNumber(),
      notes: p.notes,
      cancelledAt: p.cancelledAt,
      cancellationReason: p.cancellationReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lines: p.items.length,
      unitsOrdered: totalUnits,
      unitsReceived: received,
      receiptsCount: p.receipts?.length ?? p._count?.receipts ?? 0,
      isOverdue:
        (p.status === PurchaseStatus.ORDERED || p.status === PurchaseStatus.PARTIALLY_RECEIVED) &&
        !!p.expectedAt &&
        p.expectedAt.getTime() < Date.now(),
      ...(detailed && {
        items: (p.items as ItemRow[]).map((i) => ({
          id: i.id,
          productId: i.productId,
          sku: i.product.sku,
          name: i.product.name,
          currentStock: i.product.stock,
          quantity: i.quantity,
          unitCost: decimalToNumber(i.unitCost),
          subtotal: decimalToNumber(i.subtotal),
          receivedQuantity: i.receivedQuantity,
          pendingQuantity: i.quantity - i.receivedQuantity,
          /** Costo unitario en C$ con gastos prorrateados (el que entra al costo promedio). */
          landedUnitCost: landedUnitCost({ unitCost: i.unitCost.toString(), ...costParams }).toNumber(),
        })),
      }),
      ...(p.receipts && {
        receipts: p.receipts.map((r) => ({
          id: r.id,
          code: r.code,
          receivedAt: r.receivedAt,
          receivedBy: r.receivedBy,
          location: r.location,
          notes: r.notes,
          units: r.items.reduce((n, it) => n + it.quantity, 0),
          items: r.items.map((it) => ({
            id: it.id,
            purchaseItemId: it.purchaseItemId,
            productId: it.purchaseItem.productId,
            sku: it.purchaseItem.product.sku,
            name: it.purchaseItem.product.name,
            quantity: it.quantity,
            unitCost: decimalToNumber(it.unitCost),
            movementId: it.movement?.id ?? null,
            stockAfter: it.movement?.stockAfter ?? null,
          })),
        })),
      }),
    };
  }

  private log(actor: AuthUser, action: string, p: PurchaseRow, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'purchases',
      action,
      entity: 'Purchase',
      entityId: p.id,
      description,
      ip,
    });
  }
}
