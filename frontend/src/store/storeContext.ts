import { createContext } from 'react';
import type { LoginFailure } from '../services/auth/authService';
import type {
  CartLine, Cotizacion, Database, EstadoConsulta, MetodoPago, Result, SessionUser, TipoMovimiento, Venta,
} from '../types';

export interface ProductoInput {
  sku: string;
  nombre: string;
  descripcion: string;
  categoriaId: string | null;
  marcaId: string | null;
  precio: number;
  stockMin: number;
}

export interface ClienteInput {
  nombre: string;
  ruc: string;
  contacto: string;
  tel: string;
  correo: string;
  dir: string;
}

export interface ProveedorInput extends ClienteInput {
  pais: string;
}

export interface MovimientoInput {
  tipo: TipoMovimiento;
  prodId: string;
  /** Entrada y salida. */
  cantidad?: number;
  /** Solo entrada: costo unitario de compra. */
  costo?: number;
  /** Solo ajuste: existencia contada. */
  nuevoStock?: number;
  proveedorId?: string;
  ref: string;
  nota: string;
}

/** Condiciones de pago de una venta (nueva o convertida desde cotización). */
export interface CondicionesPago {
  metodo: MetodoPago;
  diasCredito?: number;
  abonoInicial?: number;
  metodoAbono?: 'Contado' | 'Transferencia';
  referencia?: string;
}

export type RefreshKey =
  | 'productos' | 'catalogos' | 'movimientos' | 'clientes' | 'proveedores' | 'ventas' | 'cotizaciones'
  | 'pagos' | 'cxc' | 'ordenes' | 'consultas' | 'auditoria' | 'dashboard';

export interface DataActions {
  /** El servidor ya audita cada operación; se conserva por compatibilidad. */
  registrarAuditoria(modulo: string, detalle: string): void;
  guardarProducto(id: string | null, data: ProductoInput): Promise<Result>;
  cambiarEstadoProducto(id: string, activo: boolean): Promise<Result>;
  registrarMovimiento(data: MovimientoInput): Promise<Result<{ sku: string; stock: number }>>;
  guardarCliente(id: string | null, data: ClienteInput): Promise<Result>;
  guardarProveedor(id: string | null, data: ProveedorInput): Promise<Result>;
  crearCotizacion(cliId: string, lines: CartLine[], notas: string): Promise<Result<string>>;
  cambiarEstadoCotizacion(id: string, accion: 'submit' | 'approve' | 'reject', motivo?: string): Promise<Result>;
  obtenerCotizacion(id: string): Promise<Result<Cotizacion>>;
  convertirCotizacion(id: string, terms: CondicionesPago): Promise<Result<{ ventaId: string; factura: string }>>;
  confirmarVenta(cliId: string, lines: CartLine[], terms: CondicionesPago): Promise<Result<{ ventaId: string; factura: string }>>;
  obtenerVenta(id: string): Promise<Result<Venta>>;
  anularVenta(id: string, motivo: string): Promise<Result>;
  registrarPago(ventaId: string, monto: number, metodo: 'Contado' | 'Transferencia', referencia: string): Promise<Result>;
  crearOrden(cliId: string, desc: string, tecnicoId: string | null): Promise<Result<string>>;
  asignarOrden(id: string, tecnicoId: string): Promise<Result>;
  iniciarOrden(id: string): Promise<Result>;
  completarOrden(id: string, resumen: string): Promise<Result>;
  facturarOrden(id: string, ventaId: string): Promise<Result>;
  cancelarOrden(id: string, motivo: string): Promise<Result>;
  crearConsulta(nombre: string, contacto: string, producto: string, msg: string): Promise<Result>;
  cambiarEstadoConsulta(id: string, estado: EstadoConsulta): Promise<Result>;
  refresh(keys: RefreshKey[]): Promise<void>;
}

export type LoginResult = { ok: true; user: SessionUser } | LoginFailure;
/** offline: no se pudo contactar al servidor al restaurar la sesión guardada. */
export type LogoutReason = 'manual' | 'idle' | 'expired' | 'offline';
export interface LogoutInfo {
  reason: LogoutReason;
  username: string;
}
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface StoreValue {
  db: Database;
  user: SessionUser | null;
  /** true mientras se intenta restaurar la sesión guardada al recargar la página. */
  booting: boolean;
  status: LoadStatus;
  loadError: string | null;
  login(username: string, password: string): Promise<LoginResult>;
  logout(reason?: LogoutReason): void;
  /** Motivo del último cierre de sesión (para avisar en el login). */
  lastLogout: LogoutInfo | null;
  can(permission: string): boolean;
  reload(): Promise<void>;
  actions: DataActions;
}

export const StoreContext = createContext<StoreValue | null>(null);
