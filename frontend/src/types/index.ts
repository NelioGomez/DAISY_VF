/* =====================================================================
   Tipos de dominio del frontend SIVEN.
   Son la forma en que las pantallas ven los datos; services/api/mappers.ts
   los construye a partir de las respuestas de la API NestJS.
   ===================================================================== */

export type RoleKey = 'admin' | 'gerencia' | 'vendedor' | 'inventario' | 'contabilidad' | 'tecnico';

export type ModuleId =
  | 'dashboard'
  | 'productos'
  | 'inventario'
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
  user: string;
  desc: string;
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
  nombre: string;
  descripcion: string;
  marca: string;
  marcaId: string | null;
  categoria: string;
  categoriaId: string | null;
  costo: number;
  precio: number;
  stock: number;
  stockMin: number;
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
  notas: string;
  vendedor: string;
  factura: string | null;
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

export type EstadoConsulta = 'Nueva' | 'Atendida' | 'Cerrada';

export interface ConsultaWeb {
  id: string;
  fecha: string;
  nombre: string;
  contacto: string;
  producto: string;
  msg: string;
  estado: EstadoConsulta;
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
  secciones: { ventas: boolean; inventario: boolean; cxc: boolean; ordenes: boolean; cotizaciones: boolean; consultas: boolean };
  ventas30: { total: number; facturas: number };
  ventasAcumuladas: { total: number; facturas: number };
  ventasPorDia: Array<{ dia: string; total: number }>;
  topProductos: Array<{ sku: string; nombre: string; unidades: number }>;
  porMetodo: Array<{ metodo: MetodoPago; total: number; facturas: number }>;
  ventasRecientes: Array<{ id: string; factura: string; cliente: string; total: number; estado: EstadoVenta }>;
  inventario: { productos: number; criticos: number; agotados: number; valor: number; reponer: Array<{ id: string; sku: string; nombre: string; stock: number; stockMin: number; faltan: number }> };
  cxc: { facturas: number; total: number; vencidas: number; montoVencido: number };
  ordenesAbiertas: number;
  ordenesPorEstado: Array<{ estado: EstadoOrden; cantidad: number }>;
  cotizaciones: { pendientes: number; aprobadasSinVenta: number; porVencer: number };
  consultasNuevas: number;
  alertas: Array<{ tipo: string; severidad: 'info' | 'warning' | 'critical' | string; mensaje: string }>;
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
  ventas: Venta[];
  cotizaciones: Cotizacion[];
  pagos: Pago[];
  cxc: CuentaPorCobrar[];
  ordenes: OrdenServicio[];
  tecnicos: Tecnico[];
  consultas: ConsultaWeb[];
  auditoria: RegistroAuditoria[];
  dashboard: DashboardResumen | null;
}

/** Resultado uniforme de una operación de negocio. */
export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
