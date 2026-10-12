import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { toCsv } from '../common/utils/csv';
import { addDays, parseBoundary } from '../common/utils/dates';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodGrouping, ReportName, ReportQueryDto, ServiceOrderGrouping } from './dto/report.dto';
import { int, local, money, Range, rangeConds, uuidEq, where } from './report-sql';
import { ReportColumn, ReportResult, ReportRow } from './report-types';

type Raw = Record<string, unknown>;

const DEFAULT_DAYS = 30;
const JSON_LIMIT = 1000;
const EXPORT_LIMIT = 10000;

export const REPORT_CATALOG: { name: ReportName; title: string; description: string; filters: string[] }[] = [
  { name: ReportName.SALES_BY_PERIOD, title: 'Ventas por período', description: 'Facturación, impuesto, costo y margen por día, semana o mes', filters: ['from', 'to', 'groupBy', 'customerId', 'sellerId', 'paymentMethod'] },
  { name: ReportName.SALES_BY_CUSTOMER, title: 'Ventas por cliente', description: 'Compras y saldo por cliente', filters: ['from', 'to', 'sellerId', 'paymentMethod', 'limit'] },
  { name: ReportName.SALES_BY_PRODUCT, title: 'Ventas por producto', description: 'Unidades vendidas, ingresos y margen por producto', filters: ['from', 'to', 'customerId', 'sellerId', 'categoryId', 'productId', 'limit'] },
  { name: ReportName.SALES_BY_SELLER, title: 'Ventas por vendedor', description: 'Desempeño por vendedor', filters: ['from', 'to', 'customerId', 'paymentMethod'] },
  { name: ReportName.SALES_BY_PAYMENT_METHOD, title: 'Ventas por método de pago', description: 'Contado, transferencia y crédito', filters: ['from', 'to', 'customerId', 'sellerId'] },
  { name: ReportName.INVENTORY, title: 'Inventario y valor', description: 'Existencias, costo, valor y stock crítico', filters: ['categoryId', 'brandId', 'lowStock', 'limit'] },
  { name: ReportName.INVENTORY_MOVEMENTS, title: 'Movimientos de inventario', description: 'Kardex por período', filters: ['from', 'to', 'productId', 'movementType', 'limit'] },
  { name: ReportName.RECEIVABLES, title: 'Cuentas por cobrar', description: 'Saldos pendientes con antigüedad de vencimiento', filters: ['customerId', 'limit'] },
  { name: ReportName.PAYMENTS, title: 'Pagos recibidos', description: 'Cobros por método de pago', filters: ['from', 'to', 'customerId', 'paymentMethod'] },
  { name: ReportName.SERVICE_ORDERS, title: 'Órdenes de servicio', description: 'Órdenes por estado o por técnico', filters: ['from', 'to', 'groupOrders', 'customerId', 'technicianId'] },
  { name: ReportName.QUOTATIONS, title: 'Cotizaciones', description: 'Cotizaciones por estado y tasa de conversión', filters: ['from', 'to', 'customerId', 'sellerId'] },
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  catalog() {
    return REPORT_CATALOG;
  }

  async run(name: ReportName, q: ReportQueryDto, exporting = false): Promise<ReportResult> {
    const range = this.resolveRange(name, q);
    const limit = q.limit ?? (exporting ? EXPORT_LIMIT : JSON_LIMIT);
    switch (name) {
      case ReportName.SALES_BY_PERIOD:
        return this.salesByPeriod(q, range);
      case ReportName.SALES_BY_CUSTOMER:
        return this.salesGrouped(name, 'Ventas por cliente', q, range, limit, {
          join: Prisma.sql`JOIN customers c ON c.id = s.customer_id`,
          key: Prisma.sql`c.id::text`,
          label: Prisma.sql`c.name`,
          labelHeader: 'Cliente',
          extraSelect: Prisma.sql`, COALESCE(SUM(s.balance), 0)::text AS balance`,
          extraColumn: { key: 'balance', header: 'Saldo pendiente', type: 'money' },
        });
      case ReportName.SALES_BY_SELLER:
        return this.salesGrouped(name, 'Ventas por vendedor', q, range, limit, {
          join: Prisma.sql`JOIN users u ON u.id = s.seller_id`,
          key: Prisma.sql`u.id::text`,
          label: Prisma.sql`u.first_name || ' ' || u.last_name`,
          labelHeader: 'Vendedor',
        });
      case ReportName.SALES_BY_PAYMENT_METHOD:
        return this.salesGrouped(name, 'Ventas por método de pago', q, range, limit, {
          join: Prisma.empty,
          key: Prisma.sql`s.payment_method::text`,
          label: Prisma.sql`s.payment_method::text`,
          labelHeader: 'Método de pago',
        });
      case ReportName.SALES_BY_PRODUCT:
        return this.salesByProduct(q, range, limit);
      case ReportName.INVENTORY:
        return this.inventory(q, limit);
      case ReportName.INVENTORY_MOVEMENTS:
        return this.movements(q, range, limit);
      case ReportName.RECEIVABLES:
        return this.receivables(q, limit);
      case ReportName.PAYMENTS:
        return this.payments(q, range);
      case ReportName.SERVICE_ORDERS:
        return this.serviceOrders(q, range);
      case ReportName.QUOTATIONS:
        return this.quotations(q, range);
    }
  }

  async exportCsv(name: ReportName, q: ReportQueryDto, actor: AuthUser, ip?: string) {
    const result = await this.run(name, q, true);
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'reports',
      action: 'EXPORT',
      entity: 'Report',
      entityId: name,
      description: `Exportación CSV del reporte "${result.title}" (${result.rows.length} filas)`,
      ip,
    });
    const csv = toCsv(
      result.rows,
      result.columns.map((c) => ({ header: c.header, value: (r: ReportRow) => r[c.key] })),
    );
    return { csv, filename: `${name}-${new Date().toISOString().slice(0, 10)}.csv` };
  }

  // ───────────────────────── ventas ─────────────────────────

  private readonly SALES_COLUMNS: ReportColumn[] = [
    { key: 'invoices', header: 'Facturas', type: 'int' },
    { key: 'subtotal', header: 'Subtotal', type: 'money' },
    { key: 'tax', header: 'IVA', type: 'money' },
    { key: 'total', header: 'Total', type: 'money' },
    { key: 'cost', header: 'Costo', type: 'money' },
    { key: 'margin', header: 'Margen', type: 'money' },
  ];

  private saleConds(q: ReportQueryDto, range: Range, withMethod = true): Prisma.Sql[] {
    return [
      Prisma.sql`s.status = 'ACTIVE'`,
      ...rangeConds('s.sold_at', range),
      ...uuidEq('s.customer_id', q.customerId),
      ...uuidEq('s.seller_id', q.sellerId),
      ...(withMethod && q.paymentMethod ? [Prisma.sql`s.payment_method = ${q.paymentMethod}::"PaymentMethod"`] : []),
    ];
  }

  private async salesByPeriod(q: ReportQueryDto, range: Range): Promise<ReportResult> {
    const unit = q.groupBy ?? PeriodGrouping.DAY;
    const bucket = Prisma.sql`date_trunc(${Prisma.raw(`'${unit}'`)}, ${local('s.sold_at')})`;
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      WITH sc AS (SELECT sale_id, SUM(quantity * unit_cost) AS cost FROM sale_items GROUP BY sale_id)
      SELECT to_char(${bucket}, 'YYYY-MM-DD') AS period,
             COUNT(*)::int AS invoices,
             SUM(s.subtotal)::text AS subtotal, SUM(s.tax)::text AS tax, SUM(s.total)::text AS total,
             COALESCE(SUM(sc.cost), 0)::text AS cost
      FROM sales s LEFT JOIN sc ON sc.sale_id = s.id
      ${where(this.saleConds(q, range))}
      GROUP BY 1 ORDER BY 1`)) as Raw[];
    const out = rows.map((r) => this.salesRow(r, { period: String(r.period) }));
    return this.result(ReportName.SALES_BY_PERIOD, 'Ventas por período', q, range, [
      { key: 'period', header: unit === 'day' ? 'Día' : unit === 'week' ? 'Semana (lunes)' : 'Mes', type: 'text' },
      ...this.SALES_COLUMNS,
    ], out, this.salesSummary(out), false, { groupBy: unit });
  }

  private async salesGrouped(
    name: ReportName,
    title: string,
    q: ReportQueryDto,
    range: Range,
    limit: number,
    d: {
      join: Prisma.Sql;
      key: Prisma.Sql;
      label: Prisma.Sql;
      labelHeader: string;
      extraSelect?: Prisma.Sql;
      extraColumn?: ReportColumn;
    },
  ): Promise<ReportResult> {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      WITH sc AS (SELECT sale_id, SUM(quantity * unit_cost) AS cost FROM sale_items GROUP BY sale_id)
      SELECT ${d.key} AS key, ${d.label} AS label,
             COUNT(*)::int AS invoices,
             SUM(s.subtotal)::text AS subtotal, SUM(s.tax)::text AS tax, SUM(s.total)::text AS total,
             COALESCE(SUM(sc.cost), 0)::text AS cost
             ${d.extraSelect ?? Prisma.empty}
      FROM sales s LEFT JOIN sc ON sc.sale_id = s.id
      ${d.join}
      ${where(this.saleConds(q, range, name !== ReportName.SALES_BY_PAYMENT_METHOD))}
      GROUP BY 1, 2 ORDER BY SUM(s.total) DESC, 2`)) as Raw[];
    const all = rows.map((r) =>
      this.salesRow(r, { label: String(r.label), ...(d.extraColumn && { [d.extraColumn.key]: money(r[d.extraColumn.key]) }) }),
    );
    const columns: ReportColumn[] = [
      { key: 'label', header: d.labelHeader, type: 'text' },
      ...this.SALES_COLUMNS,
      ...(d.extraColumn ? [d.extraColumn] : []),
    ];
    return this.result(name, title, q, range, columns, all.slice(0, limit), this.salesSummary(all), all.length > limit);
  }

  private async salesByProduct(q: ReportQueryDto, range: Range, limit: number): Promise<ReportResult> {
    const conds = [
      Prisma.sql`s.status = 'ACTIVE'`,
      ...rangeConds('s.sold_at', range),
      ...uuidEq('s.customer_id', q.customerId),
      ...uuidEq('s.seller_id', q.sellerId),
      ...uuidEq('p.category_id', q.categoryId),
      ...uuidEq('p.id', q.productId),
    ];
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT p.sku, p.name,
             SUM(si.quantity)::int AS units, COUNT(DISTINCT s.id)::int AS invoices,
             SUM(si.subtotal)::text AS revenue, SUM(si.quantity * si.unit_cost)::text AS cost
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      ${where(conds)}
      GROUP BY p.id, p.sku, p.name
      ORDER BY SUM(si.quantity) DESC, p.name`)) as Raw[];
    const all: ReportRow[] = rows.map((r) => ({
      sku: String(r.sku),
      name: String(r.name),
      units: int(r.units),
      invoices: int(r.invoices),
      revenue: money(r.revenue),
      cost: money(r.cost),
      margin: money(Number(r.revenue) - Number(r.cost)),
    }));
    return this.result(
      ReportName.SALES_BY_PRODUCT, 'Ventas por producto', q, range,
      [
        { key: 'sku', header: 'SKU', type: 'text' },
        { key: 'name', header: 'Producto', type: 'text' },
        { key: 'units', header: 'Unidades', type: 'int' },
        { key: 'invoices', header: 'Facturas', type: 'int' },
        { key: 'revenue', header: 'Ingresos (sin IVA)', type: 'money' },
        { key: 'cost', header: 'Costo', type: 'money' },
        { key: 'margin', header: 'Margen', type: 'money' },
      ],
      all.slice(0, limit),
      {
        products: all.length,
        units: this.sum(all, 'units'),
        revenue: money(this.sum(all, 'revenue')),
        cost: money(this.sum(all, 'cost')),
        margin: money(this.sum(all, 'margin')),
      },
      all.length > limit,
    );
  }

  private salesRow(r: Raw, head: ReportRow): ReportRow {
    return {
      ...head,
      invoices: int(r.invoices),
      subtotal: money(r.subtotal),
      tax: money(r.tax),
      total: money(r.total),
      cost: money(r.cost),
      margin: money(Number(r.subtotal) - Number(r.cost)),
    };
  }

  private salesSummary(rows: ReportRow[]): Record<string, number> {
    return {
      invoices: this.sum(rows, 'invoices'),
      subtotal: money(this.sum(rows, 'subtotal')),
      tax: money(this.sum(rows, 'tax')),
      total: money(this.sum(rows, 'total')),
      cost: money(this.sum(rows, 'cost')),
      margin: money(this.sum(rows, 'margin')),
    };
  }

  // ───────────────────────── inventario ─────────────────────────

  private async inventory(q: ReportQueryDto, limit: number): Promise<ReportResult> {
    const conds = [
      Prisma.sql`p.is_active = true`,
      ...uuidEq('p.category_id', q.categoryId),
      ...uuidEq('p.brand_id', q.brandId),
      ...(q.lowStock === true ? [Prisma.sql`p.stock <= p.min_stock`] : []),
      ...(q.lowStock === false ? [Prisma.sql`p.stock > p.min_stock`] : []),
    ];
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT p.sku, p.name, b.name AS brand, c.name AS category,
             p.stock, p.min_stock, p.avg_cost::text AS avg_cost, p.sale_price::text AS sale_price,
             (p.stock * p.avg_cost)::text AS stock_value, (p.stock <= p.min_stock) AS critical
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${where(conds)}
      ORDER BY p.name`)) as Raw[];
    const all: ReportRow[] = rows.map((r) => ({
      sku: String(r.sku),
      name: String(r.name),
      brand: (r.brand as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      stock: int(r.stock),
      minStock: int(r.min_stock),
      avgCost: money(r.avg_cost),
      salePrice: money(r.sale_price),
      stockValue: money(r.stock_value),
      critical: Boolean(r.critical),
    }));
    return this.result(
      ReportName.INVENTORY, 'Inventario y valor', q, {},
      [
        { key: 'sku', header: 'SKU', type: 'text' },
        { key: 'name', header: 'Producto', type: 'text' },
        { key: 'brand', header: 'Marca', type: 'text' },
        { key: 'category', header: 'Categoría', type: 'text' },
        { key: 'stock', header: 'Stock', type: 'int' },
        { key: 'minStock', header: 'Stock mínimo', type: 'int' },
        { key: 'avgCost', header: 'Costo promedio', type: 'money' },
        { key: 'salePrice', header: 'Precio de venta', type: 'money' },
        { key: 'stockValue', header: 'Valor en inventario', type: 'money' },
        { key: 'critical', header: 'Stock crítico', type: 'text' },
      ],
      all.slice(0, limit),
      {
        products: all.length,
        units: this.sum(all, 'stock'),
        stockValue: money(this.sum(all, 'stockValue')),
        criticalProducts: all.filter((r) => r.critical).length,
      },
      all.length > limit,
    );
  }

  private async movements(q: ReportQueryDto, range: Range, limit: number): Promise<ReportResult> {
    const conds = [
      ...rangeConds('m.created_at', range),
      ...uuidEq('m.product_id', q.productId),
      ...(q.movementType ? [Prisma.sql`m.type = ${q.movementType}::"InventoryMovementType"`] : []),
    ];
    const [rows, sums] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT to_char(${local('m.created_at')}, 'YYYY-MM-DD HH24:MI') AS date,
               p.sku, p.name, m.type::text AS type, m.quantity, m.unit_cost::text AS unit_cost,
               m.stock_before, m.stock_after, m.reference, u.username, s.name AS supplier, m.note
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN suppliers s ON s.id = m.supplier_id
        ${where(conds)}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ${limit + 1}`) as Promise<Raw[]>,
      this.prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS movements,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'ENTRY'), 0)::int AS entry_units,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'EXIT'), 0)::int AS exit_units,
               COUNT(*) FILTER (WHERE m.type = 'ADJUSTMENT')::int AS adjustments
        FROM inventory_movements m ${where(conds)}`) as Promise<Raw[]>,
    ]);
    const out: ReportRow[] = rows.slice(0, limit).map((r) => ({
      date: String(r.date),
      sku: String(r.sku),
      name: String(r.name),
      type: String(r.type),
      quantity: int(r.quantity),
      unitCost: money(r.unit_cost),
      stockBefore: int(r.stock_before),
      stockAfter: int(r.stock_after),
      reference: (r.reference as string | null) ?? null,
      user: String(r.username),
      supplier: (r.supplier as string | null) ?? null,
      note: (r.note as string | null) ?? null,
    }));
    const s = sums[0] ?? {};
    return this.result(
      ReportName.INVENTORY_MOVEMENTS, 'Movimientos de inventario', q, range,
      [
        { key: 'date', header: 'Fecha', type: 'text' },
        { key: 'sku', header: 'SKU', type: 'text' },
        { key: 'name', header: 'Producto', type: 'text' },
        { key: 'type', header: 'Tipo', type: 'text' },
        { key: 'quantity', header: 'Cantidad', type: 'int' },
        { key: 'unitCost', header: 'Costo unitario', type: 'money' },
        { key: 'stockBefore', header: 'Stock antes', type: 'int' },
        { key: 'stockAfter', header: 'Stock después', type: 'int' },
        { key: 'reference', header: 'Referencia', type: 'text' },
        { key: 'user', header: 'Usuario', type: 'text' },
        { key: 'supplier', header: 'Proveedor', type: 'text' },
        { key: 'note', header: 'Observación', type: 'text' },
      ],
      out,
      { movements: int(s.movements), entryUnits: int(s.entry_units), exitUnits: int(s.exit_units), adjustments: int(s.adjustments) },
      rows.length > limit,
    );
  }

  // ───────────────────────── cobranza ─────────────────────────

  private async receivables(q: ReportQueryDto, limit: number): Promise<ReportResult> {
    const now = new Date();
    const conds = [Prisma.sql`s.status = 'ACTIVE'`, Prisma.sql`s.balance > 0`, ...uuidEq('s.customer_id', q.customerId)];
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT s.invoice_number, c.name AS customer,
             to_char(${local('s.sold_at')}, 'YYYY-MM-DD') AS sold_at,
             to_char(${local('s.due_date')}, 'YYYY-MM-DD') AS due_date,
             EXTRACT(EPOCH FROM s.due_date)::bigint AS due_epoch,
             s.total::text AS total, s.balance::text AS balance
      FROM sales s JOIN customers c ON c.id = s.customer_id
      ${where(conds)}
      ORDER BY s.due_date ASC NULLS LAST, s.sold_at ASC`)) as Raw[];

    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const all: ReportRow[] = rows.map((r) => {
      const dueMs = r.due_epoch == null ? null : Number(r.due_epoch) * 1000;
      const days = dueMs !== null && dueMs < now.getTime() ? Math.floor((now.getTime() - dueMs) / 86_400_000) : 0;
      const bal = money(r.balance);
      const key = dueMs === null || dueMs >= now.getTime() ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90plus';
      buckets[key] = money(buckets[key] + bal);
      return {
        invoice: String(r.invoice_number),
        customer: String(r.customer),
        soldAt: String(r.sold_at),
        dueDate: (r.due_date as string | null) ?? null,
        total: money(r.total),
        balance: bal,
        daysOverdue: days,
        bucket: { current: 'Vigente', d1_30: '1-30 días', d31_60: '31-60 días', d61_90: '61-90 días', d90plus: 'Más de 90 días' }[key],
      };
    });
    return this.result(
      ReportName.RECEIVABLES, 'Cuentas por cobrar', q, {},
      [
        { key: 'invoice', header: 'Factura', type: 'text' },
        { key: 'customer', header: 'Cliente', type: 'text' },
        { key: 'soldAt', header: 'Fecha de venta', type: 'text' },
        { key: 'dueDate', header: 'Vencimiento', type: 'text' },
        { key: 'total', header: 'Total', type: 'money' },
        { key: 'balance', header: 'Saldo', type: 'money' },
        { key: 'daysOverdue', header: 'Días de atraso', type: 'int' },
        { key: 'bucket', header: 'Antigüedad', type: 'text' },
      ],
      all.slice(0, limit),
      {
        invoices: all.length,
        totalReceivable: money(this.sum(all, 'balance')),
        current: buckets.current,
        overdue1to30: buckets.d1_30,
        overdue31to60: buckets.d31_60,
        overdue61to90: buckets.d61_90,
        overdueOver90: buckets.d90plus,
      },
      all.length > limit,
    );
  }

  private async payments(q: ReportQueryDto, range: Range): Promise<ReportResult> {
    const conds = [
      ...rangeConds('p.paid_at', range),
      ...uuidEq('s.customer_id', q.customerId),
      ...(q.paymentMethod ? [Prisma.sql`p.method = ${q.paymentMethod}::"PaymentMethod"`] : []),
    ];
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT p.method::text AS method, COUNT(*)::int AS payments, SUM(p.amount)::text AS amount
      FROM payments p JOIN sales s ON s.id = p.sale_id
      ${where(conds)}
      GROUP BY 1 ORDER BY SUM(p.amount) DESC`)) as Raw[];
    const out: ReportRow[] = rows.map((r) => ({ method: String(r.method), payments: int(r.payments), amount: money(r.amount) }));
    return this.result(
      ReportName.PAYMENTS, 'Pagos recibidos', q, range,
      [
        { key: 'method', header: 'Método', type: 'text' },
        { key: 'payments', header: 'Pagos', type: 'int' },
        { key: 'amount', header: 'Monto cobrado', type: 'money' },
      ],
      out,
      { payments: this.sum(out, 'payments'), amount: money(this.sum(out, 'amount')) },
      false,
    );
  }

  // ───────────────────────── OPI y cotizaciones ─────────────────────────

  private async serviceOrders(q: ReportQueryDto, range: Range): Promise<ReportResult> {
    const byTech = q.groupOrders === ServiceOrderGrouping.TECHNICIAN;
    const conds = [
      ...rangeConds('o.registered_at', range),
      ...uuidEq('o.customer_id', q.customerId),
      ...uuidEq('o.technician_id', q.technicianId),
    ];
    const rows = (await this.prisma.$queryRaw(
      byTech
        ? Prisma.sql`
          SELECT COALESCE(u.first_name || ' ' || u.last_name, 'Sin asignar') AS label,
                 COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE o.status IN ('COMPLETED', 'INVOICED'))::int AS done,
                 COUNT(*) FILTER (WHERE o.status IN ('REGISTERED', 'ASSIGNED', 'IN_PROGRESS'))::int AS open,
                 AVG(EXTRACT(EPOCH FROM (o.finished_at - o.started_at)) / 3600)::text AS avg_hours
          FROM service_orders o LEFT JOIN users u ON u.id = o.technician_id
          ${where(conds)} GROUP BY 1 ORDER BY 2 DESC, 1`
        : Prisma.sql`
          SELECT o.status::text AS label,
                 COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE o.status IN ('COMPLETED', 'INVOICED'))::int AS done,
                 COUNT(*) FILTER (WHERE o.status IN ('REGISTERED', 'ASSIGNED', 'IN_PROGRESS'))::int AS open,
                 AVG(EXTRACT(EPOCH FROM (o.finished_at - o.started_at)) / 3600)::text AS avg_hours
          FROM service_orders o
          ${where(conds)} GROUP BY 1 ORDER BY 2 DESC, 1`,
    )) as Raw[];
    const out: ReportRow[] = rows.map((r) => ({
      label: String(r.label),
      orders: int(r.orders),
      done: int(r.done),
      open: int(r.open),
      avgHours: r.avg_hours == null ? null : money(r.avg_hours),
    }));
    return this.result(
      ReportName.SERVICE_ORDERS, 'Órdenes de servicio', q, range,
      [
        { key: 'label', header: byTech ? 'Técnico' : 'Estado', type: 'text' },
        { key: 'orders', header: 'Órdenes', type: 'int' },
        { key: 'done', header: 'Completadas/facturadas', type: 'int' },
        { key: 'open', header: 'Abiertas', type: 'int' },
        { key: 'avgHours', header: 'Horas promedio de trabajo', type: 'money' },
      ],
      out,
      { orders: this.sum(out, 'orders'), done: this.sum(out, 'done'), open: this.sum(out, 'open') },
      false,
      { groupOrders: byTech ? 'technician' : 'status' },
    );
  }

  private async quotations(q: ReportQueryDto, range: Range): Promise<ReportResult> {
    const conds = [...rangeConds('qt.issued_at', range), ...uuidEq('qt.customer_id', q.customerId), ...uuidEq('qt.seller_id', q.sellerId)];
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      SELECT qt.status::text AS status, COUNT(*)::int AS quotations, SUM(qt.total)::text AS total
      FROM quotations qt ${where(conds)} GROUP BY 1 ORDER BY 2 DESC`)) as Raw[];
    const out: ReportRow[] = rows.map((r) => ({ status: String(r.status), quotations: int(r.quotations), total: money(r.total) }));
    const submitted = out.filter((r) => r.status !== 'DRAFT').reduce((a, r) => a + Number(r.quotations), 0);
    const converted = out.find((r) => r.status === 'CONVERTED');
    return this.result(
      ReportName.QUOTATIONS, 'Cotizaciones', q, range,
      [
        { key: 'status', header: 'Estado', type: 'text' },
        { key: 'quotations', header: 'Cotizaciones', type: 'int' },
        { key: 'total', header: 'Monto cotizado', type: 'money' },
      ],
      out,
      {
        quotations: this.sum(out, 'quotations'),
        total: money(this.sum(out, 'total')),
        // Tasa de conversión sobre cotizaciones enviadas (excluye borradores).
        conversionRate: submitted ? Math.round((Number(converted?.quotations ?? 0) / submitted) * 1000) / 10 : 0,
      },
      false,
    );
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Reportes por período: sin fechas = últimos 30 días. Inventario y cobranza son "a hoy". */
  private resolveRange(name: ReportName, q: ReportQueryDto): Range {
    if (name === ReportName.INVENTORY || name === ReportName.RECEIVABLES) return {};
    const now = new Date();
    const to = q.to ? parseBoundary(q.to, 'end') : now;
    const from = q.from ? parseBoundary(q.from, 'start') : addDays(to, -DEFAULT_DAYS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException({
        message: 'Rango de fechas inválido',
        errors: [{ field: 'from', message: 'La fecha inicial no puede ser posterior a la final' }],
      });
    }
    return { from, to };
  }

  private sum(rows: ReportRow[], key: string): number {
    return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
  }

  private result(
    name: ReportName,
    title: string,
    q: ReportQueryDto,
    range: Range,
    columns: ReportColumn[],
    rows: ReportRow[],
    summary: Record<string, number>,
    truncated: boolean,
    extraFilters: Record<string, string> = {},
  ): ReportResult {
    return {
      name,
      title,
      filters: {
        from: range.from?.toISOString() ?? null,
        to: range.to?.toISOString() ?? null,
        customerId: q.customerId ?? null,
        sellerId: q.sellerId ?? null,
        productId: q.productId ?? null,
        paymentMethod: q.paymentMethod ?? null,
        ...extraFilters,
      },
      columns,
      rows,
      summary,
      truncated,
    };
  }
} //Casi 600 líneas de código.