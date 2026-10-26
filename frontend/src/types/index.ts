/* =====================================================================
   Tipos de dominio del frontend NORCOR.
   Reflejan las entidades del prototipo; cuando la API NestJS esté lista,
   estos tipos deben alinearse con los DTO de respuesta del backend.
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
  role: RoleKey;
  user: string;
  name: string;
  color: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  categoria: string;
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
}

export interface Proveedor {
  id: string;
  nombre: string;
  ruc: string;
  pais: string;
  contacto: string;
  tel: string;
  correo: string;
  dir: string;
}

export type TipoMovimiento = 'Entrada' | 'Salida' | 'Ajuste';

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  prod: string;
  prodN: string;
  cant: number;
  costo: number | null;
  ref: string;
  resp: string;
}

/** Línea de un documento comercial (cotización o venta). */
export interface LineaDocumento {
  prod: string;
  prodN: string;
  cant: number;
  precio: number;
  sub: number;
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
  vendedor: string;
  items: LineaDocumento[];
  sub: number;
  iva: number;
  total: number;
  metodo: MetodoPago;
  estado: EstadoVenta;
  saldo: number;
  vence: string | null;
}

export type EstadoCotizacion = 'Pendiente' | 'Aprobada' | 'Convertida';

export interface Cotizacion {
  id: string;
  codigo: string;
  fecha: string;
  cli: string;
  cliN: string;
  items: LineaDocumento[];
  sub: number;
  iva: number;
  total: number;
  validez: string;
  estado: EstadoCotizacion;
  vendedor: string;
}

export interface Pago {
  id: string;
  fecha: string;
  venta: string;
  factura: string;
  monto: number;
  metodo: MetodoPago;
}

export type EstadoOrden = 'Registrada' | 'Asignada' | 'En proceso' | 'Completada' | 'Facturada' | 'Cancelada';

export interface OrdenServicio {
  id: string;
  codigo: string;
  fecha: string;
  cli: string;
  desc: string;
  tecnico: string;
  estado: EstadoOrden;
}

export type EstadoConsulta = 'Nueva' | 'Atendida';

export interface ConsultaWeb {
  id: string;
  fecha: string;
  nombre: string;
  contacto: string;
  msg: string;
  estado: EstadoConsulta;
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  modulo: string;
  detalle: string;
}

/** Estado completo de la capa de datos simulada (equivale a los "repositorios" del prototipo). */
export interface Database {
  seq: number;
  productos: Producto[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  movimientos: Movimiento[];
  ventas: Venta[];
  cotizaciones: Cotizacion[];
  pagos: Pago[];
  ordenes: OrdenServicio[];
  consultas: ConsultaWeb[];
  auditoria: RegistroAuditoria[];
}

/** Resultado uniforme de una operación de negocio (simula la respuesta de la API). */
export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
