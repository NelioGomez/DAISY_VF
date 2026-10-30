/* =====================================================================
   Traducción entre la API (códigos en inglés) y las pantallas (español).
   Toda conversión de datos vive aquí: si cambia un campo en el backend,
   solo se ajusta este archivo.
   ===================================================================== */
import type {
  Catalogo,
  Cliente,
  Compra,
  ConsultaWeb,
  Cotizacion,
  CuentaPorCobrar,
  DashboardResumen,
  DocumentoRef,
  EstadoCompra,
  EstadoConsulta,
  EstadoCotizacion,
  EstadoOrden,
  EstadoVenta,
  FichaProducto,
  LineaDocumento,
  Rotacion,
  MetodoPago,
  Moneda,
  Movimiento,
  OrdenServicio,
  Pago,
  Producto,
  Proveedor,
  RegistroAuditoria,
  ResumenCompras,
  ResumenReposicion,
  RoleKey,
  SugerenciaReposicion,
  Tecnico,
  TipoMovimiento,
  Venta,
  Configuracion,
} from '../../types';

/* ---------- Códigos de la API ---------- */

export type ApiRole = 'ADMIN' | 'MANAGEMENT' | 'SELLER' | 'INVENTORY_MANAGER' | 'ACCOUNTING' | 'TECHNICIAN';
export type ApiPaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT';
export type ApiPaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';
export type ApiQuotationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED';
export type ApiServiceOrderStatus = 'REGISTERED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED' | 'CANCELLED';
export type ApiInquiryStatus = 'NEW' | 'IN_REVIEW' | 'QUOTED' | 'CLOSED' | 'CANCELLED';
export type ApiMovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT';

export const ROLE_FROM_API: Record<ApiRole, RoleKey> = {
  ADMIN: 'admin',
  MANAGEMENT: 'gerencia',
  SELLER: 'vendedor',
  INVENTORY_MANAGER: 'inventario',
  ACCOUNTING: 'contabilidad',
  TECHNICIAN: 'tecnico',
};

export const METHOD_FROM_API: Record<ApiPaymentMethod, MetodoPago> = { CASH: 'Contado', TRANSFER: 'Transferencia', CREDIT: 'Crédito' };
export const METHOD_TO_API: Record<MetodoPago, ApiPaymentMethod> = { Contado: 'CASH', Transferencia: 'TRANSFER', Crédito: 'CREDIT' };

const PAYMENT_STATUS: Record<ApiPaymentStatus, EstadoVenta> = { PAID: 'Pagada', PARTIAL: 'Parcial', PENDING: 'Pendiente' };

export const QUOTATION_STATUS: Record<ApiQuotationStatus, EstadoCotizacion> = {
  DRAFT: 'Borrador', PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', CONVERTED: 'Convertida', EXPIRED: 'Vencida',
};

export const ORDER_STATUS: Record<ApiServiceOrderStatus, EstadoOrden> = {
  REGISTERED: 'Registrada', ASSIGNED: 'Asignada', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', INVOICED: 'Facturada', CANCELLED: 'Cancelada',
};

export const INQUIRY_STATUS: Record<ApiInquiryStatus, EstadoConsulta> = {
  NEW: 'Nueva', IN_REVIEW: 'En revisión', QUOTED: 'Cotizada', CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};
export const INQUIRY_TO_API: Record<EstadoConsulta, ApiInquiryStatus> = {
  Nueva: 'NEW', 'En revisión': 'IN_REVIEW', Cotizada: 'QUOTED', Cerrada: 'CLOSED', Cancelada: 'CANCELLED',
};

const MOVEMENT_TYPE: Record<ApiMovementType, TipoMovimiento> = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' };
export const MOVEMENT_TO_API: Record<TipoMovimiento, ApiMovementType> = { Entrada: 'ENTRY', Salida: 'EXIT', Ajuste: 'ADJUSTMENT' };

export type ApiPurchaseStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export const PURCHASE_STATUS: Record<ApiPurchaseStatus, EstadoCompra> = {
  DRAFT: 'Borrador', ORDERED: 'Ordenada', PARTIALLY_RECEIVED: 'Parcial', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
};
export const PURCHASE_TO_API: Record<EstadoCompra, ApiPurchaseStatus> = {
  Borrador: 'DRAFT', Ordenada: 'ORDERED', Parcial: 'PARTIALLY_RECEIVED', Recibida: 'RECEIVED', Cancelada: 'CANCELLED',
};

/** Ícono visual por categoría (el backend no guarda íconos). */
const CATEGORY_ICON: Record<string, string> = {
  Boquillas: '⛽', Mangueras: '🧵', Filtros: '🛢️', Eléctrico: '📟', Bombas: '⚙️', Conectores: '🔩', Dispensadores: '🔌', Sellos: '🧷',
};
export const iconFor = (categoria?: string | null) => CATEGORY_ICON[categoria ?? ''] ?? '📦';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const fullName = (u?: { firstName?: string; lastName?: string; username?: string } | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || s(u.username) : '';

/* ---------- Respuestas de la API (solo los campos que se usan) ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export const mapCatalogo = (c: Json): Catalogo => ({ id: c.id, nombre: s(c.name), activo: c.isActive !== false });

export const mapProducto = (p: Json): Producto => ({
  id: p.id,
  sku: s(p.sku),
  nombre: s(p.name),
  descripcion: s(p.description),
  marca: s(p.brand?.name),
  marcaId: p.brandId ?? p.brand?.id ?? null,
  categoria: s(p.category?.name),
  categoriaId: p.categoryId ?? p.category?.id ?? null,
  costo: n(p.avgCost),
  precio: n(p.salePrice),
  stock: n(p.stock),
  stockMin: n(p.minStock),
  stockMax: p.maxStock === null || p.maxStock === undefined ? null : n(p.maxStock),
  ic: iconFor(p.category?.name),
  activo: p.isActive !== false,
});

export const mapCliente = (c: Json): Cliente => ({
  id: c.id,
  nombre: s(c.name),
  ruc: s(c.ruc),
  contacto: s(c.contactName),
  tel: s(c.phone),
  correo: s(c.email),
  dir: s(c.address),
  activo: c.isActive !== false,
  totalCompras: n(c.totalPurchases),
  saldo: n(c.pendingBalance),
});

export const mapProveedor = (p: Json): Proveedor => ({
  id: p.id,
  nombre: s(p.name),
  ruc: s(p.taxId),
  pais: s(p.country),
  internacional: !!p.isInternational,
  contacto: s(p.contactName),
  tel: s(p.phone),
  correo: s(p.email),
  dir: s(p.address),
  activo: p.isActive !== false,
});

export const mapMovimiento = (m: Json): Movimiento => ({
  id: m.id,
  fecha: s(m.createdAt),
  tipo: MOVEMENT_TYPE[m.type as ApiMovementType] ?? 'Ajuste',
  prod: s(m.productId),
  prodN: s(m.product?.name),
  sku: s(m.product?.sku),
  cant: n(m.quantity),
  costo: m.type === 'ENTRY' ? n(m.unitCost) : null,
  stockAntes: n(m.stockBefore),
  stockDespues: n(m.stockAfter),
  ref: s(m.reference),
  nota: s(m.note),
  resp: s(m.user?.username),
  proveedor: s(m.supplier?.name),
  origen: mapOrigen(m.origin),
});

/** Origen de un movimiento según la API: venta o recepción de compra. */
export function mapOrigen(o: Json): DocumentoRef | null {
  if (!o) return null;
  if (o.type === 'SALE') return { tipo: 'VENTA', id: s(o.id), codigo: s(o.code) };
  if (o.type === 'RECEIPT') return { tipo: 'RECEPCION', id: s(o.id), codigo: s(o.code), compraId: s(o.purchaseId) };
  return null;
}

/* ---------- Compras ---------- */

export const mapCompra = (c: Json): Compra => ({
  id: c.id,
  codigo: s(c.code),
  estado: PURCHASE_STATUS[c.status as ApiPurchaseStatus] ?? 'Borrador',
  proveedorId: s(c.supplier?.id),
  proveedor: s(c.supplier?.name),
  internacional: !!c.supplier?.isInternational,
  moneda: (c.currency === 'USD' ? 'USD' : 'NIO') as Moneda,
  tipoCambio: n(c.exchangeRate) || 1,
  fecha: s(c.createdAt),
  ordenada: c.orderedAt ?? null,
  esperada: c.expectedAt ?? null,
  sub: n(c.subtotal),
  gastos: n(c.additionalCosts),
  total: n(c.total),
  totalNio: n(c.totalNio),
  notas: s(c.notes),
  motivoCancelacion: s(c.cancellationReason),
  usuario: s(c.createdBy?.username),
  lineas: n(c.lines),
  unidades: n(c.unitsOrdered),
  recibidas: n(c.unitsReceived),
  recepciones: n(c.receiptsCount),
  atrasada: !!c.isOverdue,
  items: Array.isArray(c.items)
    ? c.items.map((i: Json) => ({
        id: s(i.id),
        prod: s(i.productId),
        sku: s(i.sku),
        prodN: s(i.name),
        cant: n(i.quantity),
        costo: n(i.unitCost),
        sub: n(i.subtotal),
        recibido: n(i.receivedQuantity),
        pendiente: n(i.pendingQuantity),
        costoBodega: n(i.landedUnitCost),
        stockActual: n(i.currentStock),
      }))
    : undefined,
  detalleRecepciones: Array.isArray(c.receipts)
    ? c.receipts.map((r: Json) => ({
        id: s(r.id),
        codigo: s(r.code),
        fecha: s(r.receivedAt),
        usuario: s(r.receivedBy?.username),
        ubicacion: s(r.location?.name),
        notas: s(r.notes),
        unidades: n(r.units),
        items: (r.items ?? []).map((it: Json) => ({
          id: s(it.id),
          prod: s(it.productId),
          sku: s(it.sku),
          prodN: s(it.name),
          cant: n(it.quantity),
          costo: n(it.unitCost),
          movimientoId: it.movementId ?? null,
        })),
      }))
    : undefined,
});

export const mapResumenCompras = (x: Json): ResumenCompras => ({
  porEstado: Object.fromEntries(
    (Object.keys(PURCHASE_STATUS) as ApiPurchaseStatus[]).map((k) => [PURCHASE_STATUS[k], n(x?.byStatus?.[k])]),
  ) as Record<EstadoCompra, number>,
  pendientes: n(x?.pendingReceipt),
  comprado30: { monto: n(x?.orderedLast30Days?.amount), compras: n(x?.orderedLast30Days?.purchases) },
});

export const mapSugerencia = (r: Json): SugerenciaReposicion => ({
  prod: s(r.productId),
  sku: s(r.sku),
  prodN: s(r.name),
  categoria: s(r.category),
  stock: n(r.stock),
  stockMin: n(r.minStock),
  stockMax: r.maxStock === null || r.maxStock === undefined ? null : n(r.maxStock),
  costoProm: n(r.avgCost),
  vendido30: n(r.soldLast30Days),
  diasCobertura: r.daysOfCover === null || r.daysOfCover === undefined ? null : n(r.daysOfCover),
  enCamino: n(r.incoming),
  enBorrador: n(r.drafted),
  objetivo: n(r.target),
  regla: r.rule,
  sugerido: n(r.suggestedQuantity),
  cubierto: !!r.coveredByIncoming,
  sinRegla: !!r.needsRule,
  explicacion: s(r.explanation),
  agotado: r.status === 'OUT_OF_STOCK',
  proveedor: r.preferredSupplier
    ? {
        id: s(r.preferredSupplier.id),
        nombre: s(r.preferredSupplier.name),
        ultimoCosto: r.preferredSupplier.lastCost === null ? null : n(r.preferredSupplier.lastCost),
        moneda: r.preferredSupplier.currency === 'USD' ? 'USD' : r.preferredSupplier.currency === 'NIO' ? 'NIO' : null,
        plazo: r.preferredSupplier.leadTimeDays === null ? null : n(r.preferredSupplier.leadTimeDays),
      }
    : null,
  costoEstimado: n(r.estimatedUnitCost),
  pospuestoHasta: r.postponedUntil ?? null,
});

const LOCATION_NAME: Record<number, string> = { 1: 'Bodega', 2: 'Sucursal' };

export const mapFichaProducto = (d: Json): FichaProducto => ({
  producto: mapProducto(d.product),
  estadoStock: d.availability === 'OUT_OF_STOCK' ? 'Agotado' : d.availability === 'LOW' ? 'Bajo' : 'Disponible',
  stats: d.stats
    ? {
        vendidas30: n(d.stats.unitsLast30Days),
        vendidas90: n(d.stats.unitsLast90Days),
        ingresos90: n(d.stats.revenueLast90Days),
        margen90: n(d.stats.marginLast90Days),
        ultimaVenta: d.stats.lastSaleAt ?? null,
        diasCobertura: d.stats.daysOfCover === null ? null : n(d.stats.daysOfCover),
        rotacion: (d.stats.rotation ?? 'SIN_MOVIMIENTO') as Rotacion,
      }
    : null,
  enCamino: d.incoming
    ? {
        unidades: n(d.incoming.units),
        compras: (d.incoming.purchases ?? []).map((p: Json) => ({ id: s(p.purchaseId), codigo: s(p.code), proveedor: s(p.supplier), esperada: p.expectedAt ?? null, pendiente: n(p.pending) })),
      }
    : null,
  movimientos: d.movements
    ? d.movements.map((m: Json) => ({
        ...mapMovimiento({ ...m, product: { id: d.product.id, sku: d.product.sku, name: d.product.name }, user: { username: m.user }, supplier: m.supplier ? { name: m.supplier } : null }),
        ubicacion: LOCATION_NAME[n(m.locationId)] ?? '',
      }))
    : null,
  ventas: d.sales
    ? d.sales.map((v: Json) => ({
        ventaId: s(v.saleId),
        factura: s(v.invoiceNumber),
        fecha: s(v.soldAt),
        anulada: v.status === 'VOIDED',
        cliente: s(v.customer?.name),
        cant: n(v.quantity),
        precio: n(v.unitPrice),
        sub: n(v.subtotal),
      }))
    : null,
  proveedores: d.suppliers
    ? d.suppliers.map((p: Json) => ({
        id: s(p.supplier?.id),
        nombre: s(p.supplier?.name),
        pais: s(p.supplier?.country),
        codigo: s(p.supplierSku),
        ultimoCosto: p.lastCost === null ? null : n(p.lastCost),
        moneda: (p.currency === 'USD' ? 'USD' : 'NIO') as Moneda,
        plazo: p.leadTimeDays === null ? null : n(p.leadTimeDays),
        preferente: !!p.isPreferred,
      }))
    : null,
  precios: d.prices
    ? d.prices.map((r: Json) => ({
        id: s(r.id),
        precio: n(r.price),
        desde: s(r.validFrom),
        hasta: r.validTo ? s(r.validTo) : null,
        motivo: s(r.reason),
        usuario: r.changedBy ? `@${r.changedBy.username}` : 'Sistema',
      }))
    : null,
});

export const mapResumenReposicion = (x: Json): ResumenReposicion => ({
  productos: n(x?.products),
  porPedir: n(x?.toOrder),
  unidades: n(x?.unitsSuggested),
  cubiertos: n(x?.coveredByIncoming),
  pospuestos: n(x?.postponed),
  costoEstimado: n(x?.estimatedCost),
  diasDemanda: n(x?.demandDays) || 30,
});

const mapLinea = (i: Json): LineaDocumento => ({
  prod: s(i.productId),
  prodN: s(i.name ?? i.product?.name),
  sku: s(i.sku ?? i.product?.sku),
  cant: n(i.quantity),
  precio: n(i.unitPrice),
  sub: n(i.subtotal),
  disponible: i.availableStock !== undefined ? n(i.availableStock) : undefined,
  minimo: i.minStock !== undefined ? n(i.minStock) : undefined,
});

export const mapPago = (p: Json): Pago => ({
  id: p.id,
  fecha: s(p.paidAt),
  venta: s(p.saleId ?? p.sale?.id),
  factura: s(p.sale?.invoiceNumber),
  cliN: s(p.sale?.customer?.name),
  monto: n(p.amount),
  metodo: METHOD_FROM_API[p.method as ApiPaymentMethod] ?? 'Contado',
  ref: s(p.reference),
  usuario: s(p.user?.username),
});

export const mapVenta = (v: Json): Venta => ({
  id: v.id,
  factura: s(v.invoiceNumber),
  fecha: s(v.soldAt),
  cli: s(v.customer?.id),
  cliN: s(v.customer?.name),
  ruc: s(v.customer?.ruc),
  vendedor: s(v.seller?.username),
  sub: n(v.subtotal),
  iva: n(v.tax),
  total: n(v.total),
  metodo: METHOD_FROM_API[v.paymentMethod as ApiPaymentMethod] ?? 'Contado',
  estado: v.status === 'VOIDED' ? 'Anulada' : PAYMENT_STATUS[v.paymentStatus as ApiPaymentStatus] ?? 'Pendiente',
  saldo: n(v.balance),
  vence: v.dueDate ?? null,
  vencida: !!v.isOverdue,
  motivoAnulacion: v.voidReason ?? null,
  cotizacion: v.quotation?.code ?? null,
  cotizacionId: v.quotation?.id ?? null,
  solicitud: v.quotation?.inquiry ? { id: s(v.quotation.inquiry.id), codigo: s(v.quotation.inquiry.code) } : null,
  items: Array.isArray(v.items) ? v.items.map(mapLinea) : undefined,
  pagos: Array.isArray(v.payments) ? v.payments.map((p: Json) => mapPago({ ...p, sale: { id: v.id, invoiceNumber: v.invoiceNumber, customer: v.customer } })) : undefined,
});

export const mapCotizacion = (q: Json): Cotizacion => ({
  id: q.id,
  codigo: s(q.code),
  fecha: s(q.issuedAt),
  validaHasta: s(q.validUntil),
  cli: s(q.customer?.id),
  cliN: s(q.customer?.name),
  sub: n(q.subtotal),
  iva: n(q.tax),
  total: n(q.total),
  estado: QUOTATION_STATUS[q.status as ApiQuotationStatus] ?? 'Pendiente',
  estadoDesde: s(q.statusChangedAt ?? q.issuedAt),
  notas: s(q.notes),
  motivoRechazo: s(q.rejectionReason),
  vendedor: s(q.seller?.username),
  factura: q.sale?.invoiceNumber ?? null,
  facturaId: q.sale?.id ?? null,
  solicitud: q.inquiry ? { id: s(q.inquiry.id), codigo: s(q.inquiry.code) } : null,
  items: Array.isArray(q.items) ? q.items.map(mapLinea) : undefined,
});

export const mapCxc = (r: Json): CuentaPorCobrar => ({
  venta: s(r.saleId),
  factura: s(r.invoiceNumber),
  cliN: s(r.customer?.name),
  tel: s(r.customer?.phone),
  fecha: s(r.soldAt),
  vence: r.dueDate ?? null,
  total: n(r.total),
  saldo: n(r.balance),
  estado: PAYMENT_STATUS[r.paymentStatus as ApiPaymentStatus] ?? 'Pendiente',
  vencida: !!r.isOverdue,
  diasVencida: n(r.daysOverdue),
});

export const mapOrden = (o: Json): OrdenServicio => ({
  id: o.id,
  codigo: s(o.code),
  fecha: s(o.registeredAt),
  cliId: s(o.customerId ?? o.customer?.id),
  cli: s(o.customer?.name),
  desc: s(o.description),
  tecnicoId: o.technicianId ?? o.technician?.id ?? null,
  tecnico: o.technician ? fullName(o.technician) : '—',
  estado: ORDER_STATUS[o.status as ApiServiceOrderStatus] ?? 'Registrada',
  factura: o.sale?.invoiceNumber ?? null,
});

export const mapTecnico = (t: Json): Tecnico => ({ id: t.id, nombre: fullName(t), usuario: s(t.username) });

export const mapConsulta = (c: Json): ConsultaWeb => ({
  id: c.id,
  codigo: s(c.code),
  fecha: s(c.createdAt),
  nombre: s(c.name),
  contacto: s(c.contact),
  producto: s(c.productInterest),
  msg: s(c.message),
  estado: INQUIRY_STATUS[c.status as ApiInquiryStatus] ?? 'Nueva',
  estadoDesde: s(c.statusChangedAt ?? c.createdAt),
  origen: c.source === 'PORTAL' || c.customerAccountId ? 'PORTAL' : 'WEB',
  cliente: c.customer ? { id: s(c.customer.id), nombre: s(c.customer.name) } : null,
  asignado: s(c.assignedTo?.username),
  items: (c.items ?? []).map((i: Json) => ({
    prod: s(i.productId),
    sku: s(i.product?.sku),
    prodN: s(i.product?.name),
    cant: n(i.quantity),
    nota: s(i.note),
    precio: n(i.product?.salePrice),
    stock: n(i.product?.stock),
    minimo: n(i.product?.minStock),
    activo: i.product?.isActive !== false,
  })),
  cotizacion: c.quotation
    ? {
        id: s(c.quotation.id),
        codigo: s(c.quotation.code),
        estado: QUOTATION_STATUS[c.quotation.status as ApiQuotationStatus] ?? 'Pendiente',
        total: n(c.quotation.total),
        factura: c.quotation.sale ? { id: s(c.quotation.sale.id), codigo: s(c.quotation.sale.invoiceNumber) } : null,
      }
    : null,
});

const MODULE_LABEL: Record<string, string> = {
  auth: 'Seguridad', users: 'Usuarios', products: 'Productos', inventory: 'Inventario', purchases: 'Compras', portal: 'Portal clientes', customers: 'Clientes',
  suppliers: 'Proveedores', quotations: 'Cotizaciones', sales: 'Ventas', payments: 'Pagos', 'service-orders': 'OPI',
  inquiries: 'Consultas', categories: 'Categorías', brands: 'Marcas', roles: 'Roles', reports: 'Reportes',
};

export const mapAuditoria = (a: Json): RegistroAuditoria => ({
  id: a.id,
  fecha: s(a.createdAt),
  usuario: s(a.username) || 'sistema',
  modulo: MODULE_LABEL[a.module] ?? s(a.module),
  accion: s(a.action),
  detalle: s(a.description) || s(a.action),
  ip: s(a.ip),
});

const ORDER_FLOW: ApiServiceOrderStatus[] = ['REGISTERED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

export const mapDashboard = (d: Json): DashboardResumen => ({
  secciones: {
    ventas: !!d.sales,
    inventario: !!d.inventory,
    cxc: !!d.receivables,
    ordenes: !!d.serviceOrders,
    cotizaciones: !!d.quotations,
    consultas: !!d.inquiries,
  },
  ventas30: { total: n(d.sales?.last30Days?.total), facturas: n(d.sales?.last30Days?.invoices) },
  ventasAcumuladas: { total: n(d.sales?.accumulated?.total), facturas: n(d.sales?.accumulated?.invoices) },
  ventasPorDia: (d.sales?.salesByDay ?? []).map((x: Json) => ({ dia: s(x.day), total: n(x.total) })),
  topProductos: (d.sales?.topProducts ?? []).map((x: Json) => ({ sku: s(x.sku), nombre: s(x.name), unidades: n(x.units) })),
  porMetodo: (d.sales?.byPaymentMethod ?? []).map((x: Json) => ({ metodo: METHOD_FROM_API[x.method as ApiPaymentMethod] ?? 'Contado', total: n(x.total), facturas: n(x.invoices) })),
  ventasRecientes: (d.sales?.recentSales ?? []).map((x: Json) => ({
    id: x.id,
    factura: s(x.invoiceNumber),
    cliente: s(x.customer),
    total: n(x.total),
    estado: x.status === 'VOIDED' ? 'Anulada' : PAYMENT_STATUS[x.paymentStatus as ApiPaymentStatus] ?? 'Pendiente',
  })),
  inventario: {
    productos: n(d.inventory?.activeProducts),
    criticos: n(d.inventory?.criticalProducts),
    agotados: n(d.inventory?.outOfStockProducts),
    valor: n(d.inventory?.stockValue),
    reponer: (d.inventory?.restock ?? []).map((x: Json) => ({ id: x.id, sku: s(x.sku), nombre: s(x.name), stock: n(x.stock), stockMin: n(x.minStock), faltan: n(x.missingUnits) })),
  },
  cxc: {
    facturas: n(d.receivables?.openInvoices),
    total: n(d.receivables?.totalReceivable),
    vencidas: n(d.receivables?.overdueInvoices),
    montoVencido: n(d.receivables?.overdueAmount),
  },
  ordenesAbiertas: n(d.serviceOrders?.open),
  ordenesPorEstado: ORDER_FLOW.map((k) => ({ estado: ORDER_STATUS[k], cantidad: n(d.serviceOrders?.byStatus?.[k]) })),
  cotizaciones: {
    pendientes: n(d.quotations?.pending),
    aprobadasSinVenta: n(d.quotations?.approvedAwaitingSale),
    porVencer: n(d.quotations?.expiringSoon),
  },
  consultasNuevas: n(d.inquiries?.new),
  alertas: (d.alerts ?? []).map((a: Json) => ({ tipo: s(a.type), severidad: s(a.severity), mensaje: s(a.message) })),
});

export const DEFAULT_CONFIG: Configuracion = {
  taxRate: 0,
  taxRegime: 'CUOTA_FIJA',
  creditTermDays: 15,
  empresa: { name: 'NORCOR FUELING SYSTEM', phone: '', email: '', whatsapp: '', address: '' },
};

export const mapConfig = (c: Json): Configuracion => ({
  taxRate: n(c?.taxRate),
  taxRegime: s(c?.taxRegime) || 'CUOTA_FIJA',
  creditTermDays: n(c?.creditTermDays) || 15,
  empresa: { ...DEFAULT_CONFIG.empresa, ...(c?.company ?? {}) },
});
