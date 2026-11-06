/* =====================================================================
   Tipos de dominio del frontend SIVEN.
   Son la forma en que las pantallas ven los datos; services/api/mappers.ts
   los construye a partir de las respuestas de la API NestJS.
   ===================================================================== */

import type { Unidad } from '../utils/units';

export type RoleKey = 'admin' | 'gerencia' | 'vendedor' | 'inventario' | 'contabilidad' | 'tecnico';

export type ModuleId =
  | 'dashboard'
  | 'productos'
  | 'inventario'
  | 'compras'
  | 'produccion'
  | 'clientes'
  | 'proveedores'
  | 'cotizaciones'
  | 'ventas'
  | 'pagos'
  | 'ordenes'
  | 'reportes'
  | 'catalogo'
  | 'consultas'
  | 'auditoria';

export interface RoleInfo {
  name: string;
  color: string;
}

export interface SessionUser {
  id: string;
  role: RoleKey;
  user: string;
  name: string;
  fullName: string;
  email: string;
  color: string;
  permissions: string[];
}

export interface Catalogo {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Producto {
  id: string;
  sku: string;
  /** Código de barras para el lector del punto de venta ('' = sin código). */
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  /** Imagen del producto; puede ser ruta pública (/product-images/...) o URL absoluta. */
  imagen: string;
  /** Unidad en que se controla el stock (código de la API: UNIT, FOOT…). */
  unidad: Unidad;
  marca: string;
  marcaId: string | null;
  categoria: string;
  categoriaId: string | null;
  costo: number;
  precio: number;
  stock: number;
  /** Reparto del stock (mejora n.° 23): la suma de ambos es `stock`. */
  stockBodega: number;
  stockSucursal: number;
  stockMin: number;
  /** Tope de reposición (null = sin definir). */
  stockMax: number | null;
  ic: string;
  activo: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  ruc: string;
  contacto: string;
  tel: string;
  correo: string;
  dir: string;
  activo: boolean;
  totalCompras: number;
  saldo: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
  ruc: string;
  pais: string;
  internacional: boolean;
  contacto: string;
  tel: string;
  correo: string;
  dir: string;
  activo: boolean;
}

export type TipoMovimiento = 'Entrada' | 'Salida' | 'Ajuste';

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  prod: string;
  prodN: string;
  sku: string;
  cant: number;
  costo: number | null;
  stockAntes: number;
  stockDespues: number;
  ref: string;
  nota: string;
  resp: string;
  proveedor: string;
  /** Dónde ocurrió: 1 = Bodega principal, 2 = Sucursal principal. */
  ubicacionId: number;
  ubicacion: string;
  /** Documento que originó el movimiento (venta, recepción, producción o traslado), si lo hay. */
  origen: DocumentoRef | null;
}

/* ---------- Compras y reabastecimiento ---------- */

export type EstadoCompra = 'Borrador' | 'Ordenada' | 'Parcial' | 'Recibida' | 'Cancelada';
export type Moneda = 'NIO' | 'USD';

export interface CompraLinea {
  id: string;
  prod: string;
  sku: string;
  prodN: string;
  cant: number;
  /** En la moneda de la compra. */
  costo: number;
  sub: number;
  recibido: number;
  pendiente: number;
  /** Costo unitario en C$ con gastos prorrateados (el que entra al costo promedio). */
  costoBodega: number;
  stockActual: number;
}

export interface Recepcion {
  id: string;
  codigo: string;
  fecha: string;
  usuario: string;
  ubicacion: string;
  notas: string;
  unidades: number;
  items: Array<{ id: string; prod: string; sku: string; prodN: string; cant: number; costo: number; movimientoId: string | null }>;
}

export interface Compra {
  id: string;
  codigo: string;
  estado: EstadoCompra;
  proveedorId: string;
  proveedor: string;
  internacional: boolean;
  moneda: Moneda;
  tipoCambio: number;
  fecha: string;
  ordenada: string | null;
  esperada: string | null;
  sub: number;
  gastos: number;
  total: number;
  totalNio: number;
  notas: string;
  motivoCancelacion: string;
  usuario: string;
  lineas: number;
  unidades: number;
  recibidas: number;
  recepciones: number;
  atrasada: boolean;
  /** Solo en el detalle (GET /purchases/:id). */
  items?: CompraLinea[];
  detalleRecepciones?: Recepcion[];
}

export interface ResumenCompras {
  porEstado: Record<EstadoCompra, number>;
  pendientes: number;
  comprado30: { monto: number; compras: number };
}

export type ReglaReposicion = 'MAX_STOCK' | 'TWICE_MIN' | 'MIN_PLUS_DEMAND';

export interface SugerenciaReposicion {
  prod: string;
  sku: string;
  prodN: string;
  categoria: string;
  stock: number;
  stockMin: number;
  stockMax: number | null;
  costoProm: number;
  vendido30: number;
  diasCobertura: number | null;
  enCamino: number;
  enBorrador: number;
  objetivo: number;
  regla: ReglaReposicion;
  sugerido: number;
  cubierto: boolean;
  sinRegla: boolean;
  explicacion: string;
  agotado: boolean;
  proveedor: { id: string; nombre: string; ultimoCosto: number | null; moneda: Moneda | null; plazo: number | null } | null;
  costoEstimado: number;
  pospuestoHasta: string | null;
}

export interface ResumenReposicion {
  productos: number;
  porPedir: number;
  unidades: number;
  cubiertos: number;
  pospuestos: number;
  costoEstimado: number;
  diasDemanda: number;
}

/* ---------- Ficha detallada de producto ---------- */

export type Rotacion = 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_MOVIMIENTO';

/** GET /products/:id/detail. Cada sección es null si el rol no puede verla. */
export interface FichaProducto {
  producto: Producto;
  estadoStock: 'Agotado' | 'Bajo' | 'Disponible';
  stats: {
    vendidas30: number;
    vendidas90: number;
    /** Consumidas por órdenes de producción en 90 días (cuentan para la rotación). */
    consumidas90: number;
    ingresos90: number;
    margen90: number;
    ultimaVenta: string | null;
    diasCobertura: number | null;
    rotacion: Rotacion;
  } | null;
  enCamino: { unidades: number; compras: Array<{ id: string; codigo: string; proveedor: string; esperada: string | null; pendiente: number }> } | null;
  movimientos: Movimiento[] | null;
  ventas: Array<{ ventaId: string; factura: string; fecha: string; anulada: boolean; cliente: string; cant: number; precio: number; sub: number }> | null;
  proveedores: Array<{ id: string; nombre: string; pais: string; codigo: string; ultimoCosto: number | null; moneda: Moneda; plazo: number | null; preferente: boolean }> | null;
  precios: PrecioHistorial[] | null;
}

/* ---------- Trazabilidad documental ---------- */

export type TipoDocumento = 'SOLICITUD' | 'COTIZACION' | 'VENTA' | 'PAGO' | 'COMPRA' | 'RECEPCION' | 'MOVIMIENTO' | 'PRODUCCION' | 'LOTE' | 'TRASLADO';

/** Referencia navegable a un documento relacionado. */
export interface DocumentoRef {
  tipo: TipoDocumento;
  id: string;
  codigo: string;
  /** Para movimientos de recepción: la compra a la que pertenece. */
  compraId?: string;
  /** Para entradas de producción: el lote liberado por calidad. */
  lote?: string;
}

/** Línea de un documento comercial (cotización o venta). */
export interface LineaDocumento {
  prod: string;
  prodN: string;
  sku?: string;
  cant: number;
  precio: number;
  sub: number;
  disponible?: number;
  /** Stock mínimo del producto (para advertir si la venta lo deja en nivel crítico). */
  minimo?: number;
}

/** Línea en edición dentro del editor de líneas. */
export interface CartLine {
  prod: string;
  cant: number;
}

export type MetodoPago = 'Contado' | 'Transferencia' | 'Crédito';
export type EstadoVenta = 'Pagada' | 'Pendiente' | 'Parcial' | 'Anulada';

export interface Venta {
  id: string;
  factura: string;
  fecha: string;
  cli: string;
  cliN: string;
  ruc: string;
  vendedor: string;
  sub: number;
  iva: number;
  total: number;
  metodo: MetodoPago;
  estado: EstadoVenta;
  saldo: number;
  vence: string | null;
  vencida: boolean;
  motivoAnulacion: string | null;
  cotizacion: string | null;
  cotizacionId: string | null;
  /** Solicitud web que originó la cotización (cadena SOL → COT → FAC). */
  solicitud: { id: string; codigo: string } | null;
  /** Solo en el detalle (GET /sales/:id). */
  items?: LineaDocumento[];
  pagos?: Pago[];
}

export type EstadoCotizacion = 'Borrador' | 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Convertida' | 'Vencida';

export interface Cotizacion {
  id: string;
  codigo: string;
  fecha: string;
  validaHasta: string;
  cli: string;
  cliN: string;
  sub: number;
  iva: number;
  total: number;
  estado: EstadoCotizacion;
  /** Desde cuándo está en el estado actual (para "Pendiente, hace N días"). */
  estadoDesde: string;
  notas: string;
  motivoRechazo: string;
  vendedor: string;
  factura: string | null;
  facturaId: string | null;
  /** Solicitud web de origen, si la hubo. */
  solicitud: { id: string; codigo: string } | null;
  items?: LineaDocumento[];
}

export interface Pago {
  id: string;
  fecha: string;
  venta: string;
  factura: string;
  cliN: string;
  monto: number;
  metodo: MetodoPago;
  ref: string;
  usuario: string;
}

export interface CuentaPorCobrar {
  venta: string;
  factura: string;
  cliN: string;
  tel: string;
  fecha: string;
  vence: string | null;
  total: number;
  saldo: number;
  estado: EstadoVenta;
  vencida: boolean;
  diasVencida: number;
}

export type EstadoOrden = 'Registrada' | 'Asignada' | 'En proceso' | 'Completada' | 'Facturada' | 'Cancelada';

export interface OrdenServicio {
  id: string;
  codigo: string;
  fecha: string;
  cliId: string;
  cli: string;
  desc: string;
  tecnicoId: string | null;
  tecnico: string;
  estado: EstadoOrden;
  factura: string | null;
}

export interface Tecnico {
  id: string;
  nombre: string;
  usuario: string;
}

/** Solicitud web: se conserva como evidencia aunque se convierta en cotización. */
export type EstadoConsulta = 'Nueva' | 'En revisión' | 'Cotizada' | 'Cerrada' | 'Cancelada';

export interface ConsultaWeb {
  id: string;
  /** SOL-000001 */
  codigo: string;
  fecha: string;
  nombre: string;
  contacto: string;
  producto: string;
  msg: string;
  estado: EstadoConsulta;
  estadoDesde: string;
  /** PORTAL = lista de solicitud de un cliente con cuenta; WEB = formulario de contacto. */
  origen: 'PORTAL' | 'WEB';
  cliente: { id: string; nombre: string } | null;
  asignado: string;
  items: Array<{ prod: string; sku: string; prodN: string; cant: number; nota: string; precio: number; stock: number; minimo: number; activo: boolean }>;
  cotizacion: { id: string; codigo: string; estado: EstadoCotizacion; total: number; factura: { id: string; codigo: string } | null } | null;
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  modulo: string;
  accion: string;
  detalle: string;
  ip: string;
}

export interface DashboardResumen {
  /** Secciones que el servidor envió según los permisos del rol. */
  secciones: { ventas: boolean; inventario: boolean; cxc: boolean; ordenes: boolean; cotizaciones: boolean; consultas: boolean; compras: boolean; produccion: boolean };
  ventas30: { total: number; facturas: number };
  /** Los 30 días anteriores (tendencia, mejora n.° 9). */
  ventasPrevias: { total: number; facturas: number };
  ventasAcumuladas: { total: number; facturas: number };
  ventasPorDia: Array<{ dia: string; total: number }>;
  topProductos: Array<{ sku: string; nombre: string; unidades: number }>;
  porMetodo: Array<{ metodo: MetodoPago; total: number; facturas: number }>;
  ventasRecientes: Array<{ id: string; factura: string; cliente: string; total: number; estado: EstadoVenta }>;
  inventario: { productos: number; criticos: number; agotados: number; valor: number; reponer: Array<{ id: string; sku: string; nombre: string; stock: number; stockMin: number; faltan: number }> };
  cxc: {
    facturas: number;
    total: number;
    vencidas: number;
    montoVencido: number;
    /** Antigüedad de saldos (mejora n.° 24): vigente, 1-30, 31-60, 61-90 y más de 90 días de atraso. */
    antiguedad: Array<{ clave: string; etiqueta: string; facturas: number; monto: number }>;
  };
  ordenesAbiertas: number;
  ordenesPorEstado: Array<{ estado: EstadoOrden; cantidad: number }>;
  cotizaciones: {
    pendientes: number;
    aprobadasSinVenta: number;
    porVencer: number;
    /** Emitidas y convertidas en venta en los últimos 30 días y en los 30 anteriores. */
    conversion: { actual: { emitidas: number; convertidas: number }; previa: { emitidas: number; convertidas: number } };
  };
  consultasNuevas: number;
  /** KPI de manufactura de los últimos 30 días (null si el rol no ve Producción). */
  produccion: ResumenProduccion | null;
  alertas: Array<{ tipo: string; severidad: 'info' | 'warning' | 'critical' | string; mensaje: string; cantidad: number }>;
}

/** Indicadores de manufactura calculados por el servidor con sus propios datos. */
export interface ResumenProduccion {
  /** Órdenes liberadas que esperan iniciar. */
  liberadas: number;
  enProceso: number;
  terminadas30: number;
  planificadas30: number;
  /** Unidades que calidad liberó al inventario. */
  liberadasCalidad30: number;
  desechadas30: number;
  porInspeccionar30: number;
  /** Rendimiento (yield): liberadas ÷ planificadas, en %. null = sin órdenes terminadas. */
  rendimiento: number | null;
  inspeccionadas30: number;
  noConformes30: number;
  /** No conformes ÷ inspeccionadas en la primera inspección, en %. */
  noConformidad: number | null;
  /** Promedio entre el inicio y el término de las órdenes terminadas. */
  cicloHoras: number;
  lotesPorInspeccionar: number;
}

/** Un registro del historial de precios (lo llena un trigger de la base de datos). */
export interface PrecioHistorial {
  id: string;
  precio: number;
  desde: string;
  /** null = precio vigente */
  hasta: string | null;
  motivo: string;
  usuario: string;
}

/** Parámetros del negocio (GET /settings): el impuesto lo decide el servidor. */
export interface Configuracion {
  /** 0 en régimen de cuota fija. */
  taxRate: number;
  taxRegime: 'CUOTA_FIJA' | 'IVA' | string;
  creditTermDays: number;
  empresa: { name: string; phone: string; email: string; whatsapp: string; address: string };
}

/** Estado completo cargado desde la API para la sesión actual. */
export interface Database {
  productos: Producto[];
  categorias: Catalogo[];
  marcas: Catalogo[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  movimientos: Movimiento[];
  inventarioValor: number;
  compras: Compra[];
  comprasResumen: ResumenCompras | null;
  ventas: Venta[];
  cotizaciones: Cotizacion[];
  pagos: Pago[];
  cxc: CuentaPorCobrar[];
  ordenes: OrdenServicio[];
  tecnicos: Tecnico[];
  consultas: ConsultaWeb[];
  auditoria: RegistroAuditoria[];
  dashboard: DashboardResumen | null;
  config: Configuracion;
}

/** Resultado uniforme de una operación de negocio. */
export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

/* ---------- Portal de clientes (sesión separada del personal) ---------- */

export type Disponibilidad = 'Disponible' | 'Pocas unidades' | 'Bajo pedido';

export interface CuentaCliente {
  id: string;
  email: string;
  contacto: string;
  telefono: string;
  cliente: { id: string; nombre: string; ruc: string; telefono: string; direccion: string };
}

export interface SolicitudPortal {
  id: string;
  codigo: string;
  estado: EstadoConsulta;
  estadoDesde: string;
  fecha: string;
  mensaje: string;
  items: Array<{ prod: string; sku: string; nombre: string; cant: number; nota: string; disponibilidad: Disponibilidad }>;
  cotizacion: { id: string; codigo: string; estado: EstadoCotizacion; total: number; validaHasta: string } | null;
  /** La cotización existe pero el vendedor todavía no la envía (borrador). */
  enPreparacion: boolean;
}

export interface CotizacionPortal {
  id: string;
  codigo: string;
  estado: EstadoCotizacion;
  fecha: string;
  validaHasta: string;
  sub: number;
  iva: number;
  total: number;
  notas: string;
  vendedor: { nombre: string; correo: string };
  solicitud: { id: string; codigo: string } | null;
  factura: string | null;
  items?: Array<{ sku: string; nombre: string; cant: number; precio: number; sub: number }>;
}

/** Producto del catálogo público (sin costos ni stock exacto). */
export interface ProductoPublico {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  marca: string;
  categoria: string;
  categoriaId: string | null;
  precio: number | null;
  unidad: string;
  imagen: string | null;
  disponibilidad: Disponibilidad;
  ic: string;
}

/** Línea de la lista de solicitud de cotización (carrito B2B del catálogo). */
export interface LineaLista {
  id: string;
  nombre: string;
  sku: string;
  precio: number | null;
  disponibilidad: Disponibilidad;
  categoria: string;
  imagen: string | null;
  cant: number;
  nota: string;
}
