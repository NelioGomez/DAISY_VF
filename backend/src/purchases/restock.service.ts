import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { addDays } from '../common/utils/dates';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { int, money, ts } from '../reports/report-sql';
import { FilterRestockDto, PostponeRestockDto } from './dto/purchase.dto';

/** Ventana de demanda reciente que alimenta la sugerencia. */
export const DEMAND_DAYS = 30;

export type RestockRule = 'MAX_STOCK' | 'TWICE_MIN' | 'MIN_PLUS_DEMAND';

export interface RestockInput {
  stock: number;
  minStock: number;
  maxStock: number | null;
  soldRecently: number;
  incoming: number;
}

export interface RestockPlan {
  target: number;
  rule: RestockRule;
  suggestedQuantity: number;
  coveredByIncoming: boolean;
  needsRule: boolean;
  explanation: string;
}

/**
 * Regla simple y transparente (sección 5.7 del análisis): llevar el stock a un objetivo.
 *  - Con stock máximo definido: objetivo = máximo.
 *  - Sin máximo: objetivo = el mayor entre 2 × mínimo y mínimo + ventas de los últimos 30 días.
 * Sugerido = objetivo − stock − lo que ya viene en compras ordenadas (nunca negativo).
 * Es solo una sugerencia: la compra la crea una persona, que puede cambiar la cantidad.
 */
export function planRestock(r: RestockInput): RestockPlan {
  let target: number;
  let rule: RestockRule;
  if (r.maxStock !== null && r.maxStock > 0) {
    target = r.maxStock;
    rule = 'MAX_STOCK';
  } else if (r.minStock + r.soldRecently > 2 * r.minStock) {
    target = r.minStock + r.soldRecently;
    rule = 'MIN_PLUS_DEMAND';
  } else {
    target = 2 * r.minStock;
    rule = 'TWICE_MIN';
  }
  const suggestedQuantity = Math.max(target - r.stock - r.incoming, 0);
  const coveredByIncoming = suggestedQuantity === 0 && r.incoming > 0;
  const needsRule = target === 0;

  const base =
    rule === 'MAX_STOCK'
      ? `Máximo ${target}`
      : rule === 'MIN_PLUS_DEMAND'
        ? `Mínimo ${r.minStock} + ventas de ${DEMAND_DAYS} días ${r.soldRecently}`
        : `2 × mínimo (${target})`;
  const explanation = needsRule
    ? 'Defina el stock mínimo o máximo del producto para calcular la sugerencia'
    : `${base} − stock ${r.stock}${r.incoming ? ` − en camino ${r.incoming}` : ''} = ${suggestedQuantity}`;
  return { target, rule, suggestedQuantity, coveredByIncoming, needsRule, explanation };
}

type Raw = Record<string, unknown>;

/** Panel de reabastecimiento (mejora n.° 2): convierte el stock crítico en una decisión de compra. */
@Injectable()
export class RestockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async suggestions(f: FilterRestockDto) {
    const now = new Date();
    const since = addDays(now, -DEMAND_DAYS);
    const notPostponed = Prisma.sql`(p.restock_postponed_until IS NULL OR p.restock_postponed_until <= ${ts(now)})`;

    const [rows, postponedRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        WITH sold AS (
          SELECT si.product_id, SUM(si.quantity)::int AS units
          FROM sale_items si JOIN sales s ON s.id = si.sale_id
          WHERE s.status = 'ACTIVE' AND s.sold_at >= ${ts(since)}
          GROUP BY si.product_id
        ), incoming AS (
          SELECT pi.product_id,
                 SUM(pi.quantity - pi.received_quantity) FILTER (WHERE pu.status IN ('ORDERED', 'PARTIALLY_RECEIVED'))::int AS units,
                 SUM(pi.quantity) FILTER (WHERE pu.status = 'DRAFT')::int AS drafted
          FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pu.status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED')
          GROUP BY pi.product_id
        )
        SELECT p.id, p.sku, p.name, p.stock, p.min_stock, p.max_stock, p.avg_cost::text AS avg_cost,
               p.restock_postponed_until,
               c.name AS category,
               COALESCE(sold.units, 0) AS sold, COALESCE(incoming.units, 0) AS incoming,
               COALESCE(incoming.drafted, 0) AS drafted,
               ps.supplier_id, s.name AS supplier_name, ps.last_cost::text AS last_cost,
               ps.currency::text AS currency, ps.lead_time_days
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN sold ON sold.product_id = p.id
        LEFT JOIN incoming ON incoming.product_id = p.id
        LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.is_preferred
        LEFT JOIN suppliers s ON s.id = ps.supplier_id
        WHERE p.is_active AND p.stock <= p.min_stock
          ${f.includePostponed ? Prisma.empty : Prisma.sql`AND ${notPostponed}`}
        ORDER BY (p.stock - p.min_stock) ASC, p.name`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS n FROM products p
        WHERE p.is_active AND p.stock <= p.min_stock AND NOT ${notPostponed}`) as Promise<Raw[]>,
    ]);

    const data = rows.map((r) => this.toSuggestion(r, now));
    const estimatedCost = data.reduce((acc, d) => acc + d.suggestedQuantity * d.estimatedUnitCost, 0);
    return {
      data,
      summary: {
        products: data.length,
        toOrder: data.filter((d) => d.suggestedQuantity > 0).length,
        unitsSuggested: data.reduce((n, d) => n + d.suggestedQuantity, 0),
        coveredByIncoming: data.filter((d) => d.coveredByIncoming).length,
        postponed: int(postponedRows[0]?.n),
        /** Estimación en C$ con el último costo en córdobas del proveedor o, si no hay, el costo promedio. */
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        demandDays: DEMAND_DAYS,
      },
    };
  }

  async postpone(productId: string, dto: PostponeRestockDto, actor: AuthUser, ip?: string) {
    const product = await this.findProduct(productId);
    const until = addDays(new Date(), dto.days);
    await this.prisma.product.update({ where: { id: productId }, data: { restockPostponedUntil: until } });
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'purchases',
      action: 'RESTOCK_POSTPONE',
      entity: 'Product',
      entityId: productId,
      description: `Reabastecimiento de ${product.sku} pospuesto ${dto.days} día(s)${dto.reason ? `: ${dto.reason}` : ''}`,
      ip,
    });
    return { productId, postponedUntil: until };
  }

  async resume(productId: string, actor: AuthUser, ip?: string) {
    const product = await this.findProduct(productId);
    await this.prisma.product.update({ where: { id: productId }, data: { restockPostponedUntil: null } });
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'purchases',
      action: 'RESTOCK_RESUME',
      entity: 'Product',
      entityId: productId,
      description: `${product.sku} vuelve al panel de reabastecimiento`,
      ip,
    });
    return { productId, postponedUntil: null };
  }

  // ───────────────────────── helpers ─────────────────────────

  private async findProduct(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { sku: true } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  private toSuggestion(r: Raw, now: Date) {
    const stock = int(r.stock);
    const minStock = int(r.min_stock);
    const maxStock = r.max_stock === null || r.max_stock === undefined ? null : int(r.max_stock);
    const sold = int(r.sold);
    const incoming = int(r.incoming);
    const plan = planRestock({ stock, minStock, maxStock, soldRecently: sold, incoming });
    const avgCost = Number(r.avg_cost ?? 0);
    const lastCost = r.last_cost === null || r.last_cost === undefined ? null : Number(r.last_cost);
    const currency = r.currency ? String(r.currency) : null;
    const dailyDemand = sold / DEMAND_DAYS;
    const postponedUntil = (r.restock_postponed_until as Date | null) ?? null;
    return {
      productId: String(r.id),
      sku: String(r.sku),
      name: String(r.name),
      category: r.category ? String(r.category) : null,
      stock,
      minStock,
      maxStock,
      avgCost: Math.round(avgCost * 10000) / 10000,
      soldLast30Days: sold,
      dailyDemand: Math.round(dailyDemand * 100) / 100,
      /** Días que alcanza el stock al ritmo de venta reciente (null si no hubo ventas). */
      daysOfCover: dailyDemand > 0 ? Math.floor(stock / dailyDemand) : null,
      incoming,
      drafted: int(r.drafted),
      ...plan,
      status: stock <= 0 ? ('OUT_OF_STOCK' as const) : ('CRITICAL' as const),
      preferredSupplier: r.supplier_id
        ? {
            id: String(r.supplier_id),
            name: String(r.supplier_name),
            lastCost,
            currency,
            leadTimeDays: r.lead_time_days === null || r.lead_time_days === undefined ? null : int(r.lead_time_days),
          }
        : null,
      /** Costo unitario estimado en C$ (para el total aproximado de la sugerencia). */
      estimatedUnitCost: money(currency === 'NIO' && lastCost !== null ? lastCost : avgCost),
      postponedUntil: postponedUntil && postponedUntil.getTime() > now.getTime() ? postponedUntil : null,
    };
  }
}
