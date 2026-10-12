import { Injectable } from '@nestjs/common';
import { addDays } from '../common/utils/dates';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { int, local, money, ts } from '../reports/report-sql';

type Raw = Record<string, unknown>;

export interface Alert {
  type: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVERDUE_RECEIVABLES' | 'NEW_INQUIRIES' | 'QUOTATIONS_EXPIRING';
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

    const [sales, inventory, receivables, orders, quotations, inquiries] = await Promise.all([
      canSales ? this.sales(now, since) : null,
      canStock ? this.inventory(can(actor, 'inventory:read')) : null,
      canAr ? this.receivables(now) : null,
      can(actor, 'service-orders:read') ? this.serviceOrders(actor) : null,
      can(actor, 'quotations:read') ? this.quotations(now) : null,
      can(actor, 'inquiries:read') ? this.inquiries() : null,
    ]);

    return {
      generatedAt: now,
      sales,
      inventory,
      receivables,
      serviceOrders: orders,
      quotations,
      inquiries,
      alerts: this.alerts(inventory, receivables, quotations, inquiries),
    };
  }

  // ───────────────────────── secciones ─────────────────────────

  private async sales(now: Date, since: Date) {
    const active = Prisma.sql`s.status = 'ACTIVE'`;
    const dayExpr = Prisma.sql`date_trunc('day', ${local('s.sold_at')})`;
    const chartFrom = addDays(now, -(SALES_DAYS + 1));

    const [totals, byDay, top, byMethod, recent] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(s.total), 0)::text AS all_total, COUNT(*)::int AS all_count,
               COALESCE(SUM(s.total) FILTER (WHERE s.sold_at >= ${ts(since)}), 0)::text AS last_total,
               COUNT(*) FILTER (WHERE s.sold_at >= ${ts(since)})::int AS last_count
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
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS open_invoices, COALESCE(SUM(balance), 0)::text AS balance,
             COUNT(*) FILTER (WHERE due_date < ${ts(now)})::int AS overdue_invoices,
             COALESCE(SUM(balance) FILTER (WHERE due_date < ${ts(now)}), 0)::text AS overdue_balance
      FROM sales WHERE status = 'ACTIVE' AND balance > 0`)) as Raw[];
    const r = rows[0] ?? {};
    return {
      openInvoices: int(r.open_invoices),
      totalReceivable: money(r.balance),
      overdueInvoices: int(r.overdue_invoices),
      overdueAmount: money(r.overdue_balance),
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

  private async quotations(now: Date) {
    const soon = addDays(now, 3);
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
             COUNT(*) FILTER (WHERE status IN ('PENDING', 'APPROVED')
                              AND valid_until >= ${ts(now)} AND valid_until <= ${ts(soon)})::int AS expiring
      FROM quotations`)) as Raw[];
    const r = rows[0] ?? {};
    return { pending: int(r.pending), approvedAwaitingSale: int(r.approved), expiringSoon: int(r.expiring) };
  }

  private async inquiries() {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE status = 'NEW')::int AS new_count FROM web_inquiries`)) as Raw[];
    return { new: int(rows[0]?.new_count) };
  }

  // ───────────────────────── alertas ─────────────────────────

  private alerts(
    inv: { criticalProducts: number; outOfStockProducts: number } | null,
    ar: { overdueInvoices: number; overdueAmount: number } | null,
    q: { expiringSoon: number } | null,
    inq: { new: number } | null,
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
    if (q?.expiringSoon) {
      out.push({ type: 'QUOTATIONS_EXPIRING', severity: 'warning', count: q.expiringSoon, message: `${q.expiringSoon} cotización(es) vencen en 3 días` });
    }
    if (inq?.new) {
      out.push({ type: 'NEW_INQUIRIES', severity: 'info', count: inq.new, message: `${inq.new} consulta(s) web nueva(s)` });
    }
    return out;
  }

  /** Fecha calendario (YYYY-MM-DD) en hora de Nicaragua. */
  private localDay(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
}