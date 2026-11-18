import { Injectable } from '@nestjs/common';
import { addDays } from '../common/utils/dates';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { int, local, money, ts } from '../reports/report-sql';

type Raw = Record<string, unknown>;

/**
 * Pendientes accionables (mejoras n.° 1 y 40): el frontend los muestra en la campana y en
 * "Pendientes para hoy", y decide a qué pantalla lleva cada tipo.
 */
export interface Alert {
  type:
    | 'OUT_OF_STOCK'
    | 'LOW_STOCK'
    | 'OVERDUE_RECEIVABLES'
    | 'RECEIVABLES_DUE_SOON'
    | 'QUOTATIONS_EXPIRING'
    | 'QUOTATIONS_APPROVED'
    | 'NEW_INQUIRIES'
    | 'PURCHASES_LATE'
    | 'PURCHASES_TO_RECEIVE'
    | 'SERVICE_ORDERS_UNASSIGNED'
    | 'SERVICE_ORDERS_ASSIGNED'
    | 'LOTS_PENDING_QC'
    | 'PRODUCTION_RELEASED';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  count: number;
}

const SALES_DAYS = 14;
const WINDOW_DAYS = 30;

/** Un usuario puede ver una sección solo si tiene el permiso (el Administrador todo). */
const can = (u: AuthUser, perm: string): boolean => u.role === UserRole.ADMIN || u.permissions.includes(perm);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen gerencial con datos reales. Cada sección se incluye solo si el usuario tiene permiso
   * sobre ese módulo (ej. un técnico únicamente ve sus órdenes OPI); las demás vienen en null.
   */
  async summary(actor: AuthUser) {
    const now = new Date();
    const since = addDays(now, -WINDOW_DAYS);
    const canSales = can(actor, 'sales:read');
    const canStock = can(actor, 'inventory:read') || can(actor, 'products:read');
    const canAr = can(actor, 'payments:read') || canSales;

    const [sales, inventory, receivables, orders, quotations, inquiries, purchases, production] = await Promise.all([
      canSales ? this.sales(now, since) : null,
      canStock ? this.inventory(can(actor, 'inventory:read')) : null,
      canAr ? this.receivables(now) : null,
      can(actor, 'service-orders:read') ? this.serviceOrders(actor) : null,
      can(actor, 'quotations:read') ? this.quotations(now, since) : null,
      can(actor, 'inquiries:read') ? this.inquiries() : null,
      can(actor, 'purchases:read') ? this.purchases(now) : null,
      can(actor, 'production:read') ? this.production(since) : null,
    ]);

    return {
      generatedAt: now,
      sales,
      inventory,
      receivables,
      serviceOrders: orders,
      quotations,
      inquiries,
      purchases,
      production,
      alerts: [
        ...this.alerts(inventory, receivables, quotations, inquiries, purchases, orders, actor.role === UserRole.TECHNICIAN),
        ...this.productionAlerts(production),
      ],
    };
  }

  // ───────────────────────── secciones ─────────────────────────

  private async sales(now: Date, since: Date) {
    const active = Prisma.sql`s.status = 'ACTIVE'`;
    const dayExpr = Prisma.sql`date_trunc('day', ${local('s.sold_at')})`;
    const chartFrom = addDays(now, -(SALES_DAYS + 1));
    const prevFrom = addDays(since, -WINDOW_DAYS);

    const [totals, byDay, top, byMethod, recent] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(s.total), 0)::text AS all_total, COUNT(*)::int AS all_count,
               COALESCE(SUM(s.total) FILTER (WHERE s.sold_at >= ${ts(since)}), 0)::text AS last_total,
               COUNT(*) FILTER (WHERE s.sold_at >= ${ts(since)})::int AS last_count,
               COALESCE(SUM(s.total) FILTER (WHERE s.sold_at >= ${ts(prevFrom)} AND s.sold_at < ${ts(since)}), 0)::text AS prev_total,
               COUNT(*) FILTER (WHERE s.sold_at >= ${ts(prevFrom)} AND s.sold_at < ${ts(since)})::int AS prev_count
        FROM sales s WHERE ${active}`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT to_char(${dayExpr}, 'YYYY-MM-DD') AS day, SUM(s.total)::text AS total, COUNT(*)::int AS invoices
        FROM sales s WHERE ${active} AND s.sold_at >= ${ts(chartFrom)}
        GROUP BY 1 ORDER BY 1`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT p.sku, p.name, SUM(si.quantity)::int AS units
        FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
        WHERE ${active} AND s.sold_at >= ${ts(since)}
        GROUP BY p.id, p.sku, p.name ORDER BY SUM(si.quantity) DESC, p.name LIMIT 5`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT s.payment_method::text AS method, SUM(s.total)::text AS total, COUNT(*)::int AS invoices
        FROM sales s WHERE ${active} AND s.sold_at >= ${ts(since)}
        GROUP BY 1 ORDER BY SUM(s.total) DESC`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT s.id, s.invoice_number, c.name AS customer, s.total::text AS total,
               s.payment_status::text AS payment_status, s.status::text AS status, s.sold_at
        FROM sales s JOIN customers c ON c.id = s.customer_id
        ORDER BY s.sold_at DESC, s.id DESC LIMIT 5`) as Promise<Raw[]>,
    ]);

    const t = totals[0] ?? {};
    // Rellena con ceros los días sin ventas (en hora de Nicaragua).
    const map = new Map(byDay.map((r) => [String(r.day), r]));
    const series = Array.from({ length: SALES_DAYS }, (_, i) => {
      const day = this.localDay(addDays(now, -(SALES_DAYS - 1 - i)));
      const r = map.get(day);
      return { day, total: money(r?.total), invoices: int(r?.invoices) };
    });

    return {
      last30Days: { total: money(t.last_total), invoices: int(t.last_count) },
      // Los 30 días anteriores, para mostrar la tendencia (mejora n.° 9).
      previous30Days: { total: money(t.prev_total), invoices: int(t.prev_count) },
      accumulated: { total: money(t.all_total), invoices: int(t.all_count) },
      salesByDay: series,
      topProducts: top.map((r) => ({ sku: String(r.sku), name: String(r.name), units: int(r.units) })),
      byPaymentMethod: byMethod.map((r) => ({ method: String(r.method), total: money(r.total), invoices: int(r.invoices) })),
      recentSales: recent.map((r) => ({
        id: String(r.id),
        invoiceNumber: String(r.invoice_number),
        customer: String(r.customer),
        total: money(r.total),
        paymentStatus: String(r.payment_status),
        status: String(r.status),
        soldAt: r.sold_at as Date,
      })),
    };
  }

  private async inventory(withValue: boolean) {
    const [stats, restock] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS products,
               COUNT(*) FILTER (WHERE stock <= min_stock)::int AS critical,
               COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock,
               COALESCE(SUM(stock * avg_cost), 0)::text AS stock_value
        FROM products WHERE is_active = true`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT id, sku, name, stock, min_stock
        FROM products WHERE is_active = true AND stock <= min_stock
        ORDER BY (stock - min_stock) ASC, name LIMIT 10`) as Promise<Raw[]>,
    ]);
    const s = stats[0] ?? {};
    return {
      activeProducts: int(s.products),
      criticalProducts: int(s.critical),
      outOfStockProducts: int(s.out_of_stock),
      // El valor del inventario (costos) solo se muestra a quien puede ver inventario.
      stockValue: withValue ? money(s.stock_value) : null,
      restock: restock.map((r) => ({
        id: String(r.id),
        sku: String(r.sku),
        name: String(r.name),
        stock: int(r.stock),
        minStock: int(r.min_stock),
        missingUnits: Math.max(int(r.min_stock) - int(r.stock), 0),
      })),
    };
  }

  private async receivables(now: Date) {
    // Mismos tramos que el reporte de cuentas por cobrar (días de atraso desde el vencimiento).
    const [t31, t61, t91, soon] = [addDays(now, -31), addDays(now, -61), addDays(now, -91), addDays(now, 2)];
    const bucket = (cond: Prisma.Sql, alias: string) =>
      Prisma.sql`COUNT(*) FILTER (WHERE ${cond})::int AS ${Prisma.raw(alias + '_n')},
                 COALESCE(SUM(balance) FILTER (WHERE ${cond}), 0)::text AS ${Prisma.raw(alias + '_amt')}`;
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS open_invoices, COALESCE(SUM(balance), 0)::text AS balance,
             COUNT(*) FILTER (WHERE due_date < ${ts(now)})::int AS overdue_invoices,
             COALESCE(SUM(balance) FILTER (WHERE due_date < ${ts(now)}), 0)::text AS overdue_balance,
             COUNT(*) FILTER (WHERE due_date >= ${ts(now)} AND due_date < ${ts(soon)})::int AS due_soon,
             ${bucket(Prisma.sql`due_date IS NULL OR due_date >= ${ts(now)}`, 'current')},
             ${bucket(Prisma.sql`due_date < ${ts(now)} AND due_date > ${ts(t31)}`, 'd1_30')},
             ${bucket(Prisma.sql`due_date <= ${ts(t31)} AND due_date > ${ts(t61)}`, 'd31_60')},
             ${bucket(Prisma.sql`due_date <= ${ts(t61)} AND due_date > ${ts(t91)}`, 'd61_90')},
             ${bucket(Prisma.sql`due_date <= ${ts(t91)}`, 'd90plus')}
      FROM sales WHERE status = 'ACTIVE' AND balance > 0`)) as Raw[];
    const r = rows[0] ?? {};
    return {
      openInvoices: int(r.open_invoices),
      totalReceivable: money(r.balance),
      overdueInvoices: int(r.overdue_invoices),
      overdueAmount: money(r.overdue_balance),
      dueSoonInvoices: int(r.due_soon),
      // Antigüedad de saldos (mejora n.° 24).
      aging: (['current', 'd1_30', 'd31_60', 'd61_90', 'd90plus'] as const).map((key) => ({
        key,
        invoices: int(r[`${key}_n`]),
        amount: money(r[`${key}_amt`]),
      })),
    };
  }

  private async serviceOrders(actor: AuthUser) {
    // Un técnico solo cuenta sus propias órdenes.
    const own = actor.role === UserRole.TECHNICIAN ? Prisma.sql`WHERE technician_id = ${actor.id}::uuid` : Prisma.empty;
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT status::text AS status, COUNT(*)::int AS orders FROM service_orders ${own} GROUP BY 1`)) as Raw[];
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => (byStatus[String(r.status)] = int(r.orders)));
    const open = ['REGISTERED', 'ASSIGNED', 'IN_PROGRESS'].reduce((a, s) => a + (byStatus[s] ?? 0), 0);
    return { open, byStatus };
  }

  private async quotations(now: Date, since: Date) {
    const soon = addDays(now, 3);
    const prevFrom = addDays(since, -WINDOW_DAYS);
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
             COUNT(*) FILTER (WHERE status IN ('PENDING', 'APPROVED')
                              AND valid_until >= ${ts(now)} AND valid_until <= ${ts(soon)})::int AS expiring,
             COUNT(*) FILTER (WHERE status <> 'DRAFT' AND issued_at >= ${ts(since)})::int AS issued_last,
             COUNT(*) FILTER (WHERE status = 'CONVERTED' AND issued_at >= ${ts(since)})::int AS converted_last,
             COUNT(*) FILTER (WHERE status <> 'DRAFT' AND issued_at >= ${ts(prevFrom)} AND issued_at < ${ts(since)})::int AS issued_prev,
             COUNT(*) FILTER (WHERE status = 'CONVERTED' AND issued_at >= ${ts(prevFrom)} AND issued_at < ${ts(since)})::int AS converted_prev
      FROM quotations`)) as Raw[];
    const r = rows[0] ?? {};
    return {
      pending: int(r.pending),
      approvedAwaitingSale: int(r.approved),
      expiringSoon: int(r.expiring),
      // Conversión cotización → venta de las emitidas en cada período (mejora n.° 9).
      conversion: {
        last30Days: { issued: int(r.issued_last), converted: int(r.converted_last) },
        previous30Days: { issued: int(r.issued_prev), converted: int(r.converted_prev) },
      },
    };
  }

  /**
   * KPI de manufactura (entrega 2) calculados con los datos del sistema, últimos 30 días:
   * - Rendimiento: unidades liberadas por calidad ÷ unidades planificadas de las OP terminadas.
   * - Tasa de no conformidad: no conformes ÷ inspeccionadas en la primera inspección.
   * - Tiempo de ciclo: promedio entre el inicio y el término de las OP terminadas.
   */
  private async production(since: Date) {
    const [orders, lots, qc, pending] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE status = 'RELEASED')::int AS released,
               COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
               COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${ts(since)})::int AS completed,
               COALESCE(SUM(quantity) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${ts(since)}), 0)::int AS planned,
               COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)
                        FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${ts(since)}), 0)::text AS cycle_hours
        FROM production_orders`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(l.released_quantity), 0)::int AS released,
               COALESCE(SUM(l.scrapped_quantity), 0)::int AS scrapped,
               COALESCE(SUM(l.pending_quantity + l.rework_quantity), 0)::int AS awaiting
        FROM production_lots l JOIN production_orders o ON o.id = l.order_id
        WHERE o.status = 'COMPLETED' AND o.completed_at >= ${ts(since)}`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(inspected_quantity), 0)::int AS inspected,
               COALESCE(SUM(defective_quantity), 0)::int AS defective
        FROM quality_inspections WHERE stage = 'INITIAL' AND inspected_at >= ${ts(since)}`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE status IN ('PENDING_QC', 'REWORK'))::int AS lots
        FROM production_lots`) as Promise<Raw[]>,
    ]);
    const o = orders[0] ?? {};
    const l = lots[0] ?? {};
    const q = qc[0] ?? {};
    const planned = int(o.planned);
    const inspected = int(q.inspected);
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    return {
      releasedOrders: int(o.released),
      inProgressOrders: int(o.in_progress),
      completedOrders30: int(o.completed),
      plannedUnits30: planned,
      releasedUnits30: int(l.released),
      scrappedUnits30: int(l.scrapped),
      awaitingInspectionUnits30: int(l.awaiting),
      yieldPercent: pct(int(l.released), planned),
      inspectedUnits30: inspected,
      defectiveUnits30: int(q.defective),
      nonconformityPercent: pct(int(q.defective), inspected),
      avgCycleHours: Math.round(Number(o.cycle_hours ?? 0) * 100) / 100,
      lotsPendingQc: int(pending[0]?.lots),
    };
  }

  private productionAlerts(p: { lotsPendingQc: number; releasedOrders: number } | null): Alert[] {
    const out: Alert[] = [];
    if (p?.lotsPendingQc) {
      out.push({ type: 'LOTS_PENDING_QC', severity: 'warning', count: p.lotsPendingQc, message: `${p.lotsPendingQc} lote(s) esperan inspección de calidad` });
    }
    if (p?.releasedOrders) {
      out.push({ type: 'PRODUCTION_RELEASED', severity: 'info', count: p.releasedOrders, message: `${p.releasedOrders} orden(es) de producción liberada(s) por iniciar` });
    }
    return out;
  }

  private async purchases(now: Date) {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS to_receive,
             COUNT(*) FILTER (WHERE expected_at < ${ts(now)})::int AS late
      FROM purchases WHERE status IN ('ORDERED', 'PARTIALLY_RECEIVED')`)) as Raw[];
    return { toReceive: int(rows[0]?.to_receive), late: int(rows[0]?.late) };
  }

  private async inquiries() {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE status = 'NEW')::int AS new_count FROM web_inquiries`)) as Raw[];
    return { new: int(rows[0]?.new_count) };
  }

  // ───────────────────────── alertas ─────────────────────────

  private alerts(
    inv: { criticalProducts: number; outOfStockProducts: number } | null,
    ar: { overdueInvoices: number; overdueAmount: number; dueSoonInvoices: number } | null,
    q: { expiringSoon: number; approvedAwaitingSale: number } | null,
    inq: { new: number } | null,
    pur: { toReceive: number; late: number } | null = null,
    so: { byStatus: Record<string, number> } | null = null,
    technician = false,
  ): Alert[] {
    const out: Alert[] = [];
    if (inv?.outOfStockProducts) {
      out.push({ type: 'OUT_OF_STOCK', severity: 'critical', count: inv.outOfStockProducts, message: `${inv.outOfStockProducts} producto(s) agotado(s)` });
    }
    const lowOnly = (inv?.criticalProducts ?? 0) - (inv?.outOfStockProducts ?? 0);
    if (lowOnly > 0) {
      out.push({ type: 'LOW_STOCK', severity: 'warning', count: lowOnly, message: `${lowOnly} producto(s) con stock crítico` });
    }
    if (ar?.overdueInvoices) {
      out.push({
        type: 'OVERDUE_RECEIVABLES', severity: 'critical', count: ar.overdueInvoices,
        message: `${ar.overdueInvoices} factura(s) vencida(s) por C$ ${ar.overdueAmount.toFixed(2)}`,
      });
    }
    if (ar?.dueSoonInvoices) {
      out.push({ type: 'RECEIVABLES_DUE_SOON', severity: 'warning', count: ar.dueSoonInvoices, message: `${ar.dueSoonInvoices} factura(s) vencen hoy o mañana` });
    }
    if (q?.expiringSoon) {
      out.push({ type: 'QUOTATIONS_EXPIRING', severity: 'warning', count: q.expiringSoon, message: `${q.expiringSoon} cotización(es) vencen en 3 días` });
    }
    if (inq?.new) {
      out.push({ type: 'NEW_INQUIRIES', severity: 'info', count: inq.new, message: `${inq.new} consulta(s) web nueva(s)` });
    }
    if (q?.approvedAwaitingSale) {
      out.push({ type: 'QUOTATIONS_APPROVED', severity: 'info', count: q.approvedAwaitingSale, message: `${q.approvedAwaitingSale} cotización(es) aprobada(s) sin venta` });
    }
    if (pur?.late) {
      out.push({ type: 'PURCHASES_LATE', severity: 'warning', count: pur.late, message: `${pur.late} compra(s) atrasada(s) en llegar` });
    }
    const onTime = (pur?.toReceive ?? 0) - (pur?.late ?? 0);
    if (onTime > 0) {
      out.push({ type: 'PURCHASES_TO_RECEIVE', severity: 'info', count: onTime, message: `${onTime} compra(s) por recibir` });
    }
    // Un técnico ve sus órdenes por atender; los demás, las que nadie tiene asignadas.
    const mine = (so?.byStatus.ASSIGNED ?? 0) + (so?.byStatus.IN_PROGRESS ?? 0);
    if (technician && mine) {
      out.push({ type: 'SERVICE_ORDERS_ASSIGNED', severity: 'info', count: mine, message: `${mine} orden(es) de servicio asignada(s) a usted` });
    }
    if (!technician && so?.byStatus.REGISTERED) {
      out.push({ type: 'SERVICE_ORDERS_UNASSIGNED', severity: 'warning', count: so.byStatus.REGISTERED, message: `${so.byStatus.REGISTERED} orden(es) de servicio sin técnico` });
    }
    return out;
  }

  /** Fecha calendario (YYYY-MM-DD) en hora de Nicaragua. */
  private localDay(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
}

