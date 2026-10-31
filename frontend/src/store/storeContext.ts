import { createContext } from 'react';
import type { LoginFailure } from '../services/auth/authService';
import type { RealtimeStatus } from '../services/realtime/realtime';
import type {
  CartLine,
  Compra,
  ConsultaWeb,
  Cotizacion,
  FichaProducto,
  Database,
  EstadoConsulta,
  MetodoPago,
  Moneda,
  PrecioHistorial,
  ResumenReposicion,
  Result,
  SessionUser,
  SugerenciaReposicion,
  TipoMovimiento,
  Venta,
} from '../types';
import type { Unidad } from '../utils/units';

export interface ProductoInput {
  sku: string;
  /** '' = sin código de barras. */
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  /** Unidad de control del stock (UNIT, FOOT…). */
  unidad: Unidad;
  categoriaId: string | null;
  marcaId: string | null;
  /** Solo se envía si cambió y el rol tiene prices:write (Administración / Gerencia). */
  precio?: number;
  /** Motivo del cambio de precio (queda en el historial). */
  motivoPrecio?: string;
  stockMin: number;
  /** Tope de reposición; null = sin definir. */
  stockMax: number | null;
}

export interface CompraLineaInput {
  prod: string;
  cant: number;
  /** Costo unitario del proveedor, en la moneda de la compra. */
  costo: number;
}

export interface CompraInput {
  proveedorId: string;
  moneda: Moneda;
  /** C$ por US$ (solo en dólares). */
  tipoCambio?: number;
  /** AAAA-MM-DD */
  esperada?: string;
  gastos?: number;
  notas?: string;
  lineas: CompraLineaInput[];
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
  | 'productos' | 'catalogos' | 'movimientos' | 'compras' | 'clientes' | 'proveedores' | 'ventas' | 'cotizaciones'
  | 'pagos' | 'cxc' | 'ordenes' | 'consultas' | 'auditoria' | 'dashboard' | 'config';

export interface DataActions {
  /** El servidor ya audita cada operación; se conserva por compatibilidad. */
  registrarAuditoria(modulo: string, detalle: string): void;
  guardarProducto(id: string | null, data: ProductoInput): Promise<Result>;
  cambiarEstadoProducto(id: string, activo: boolean): Promise<Result>;
  registrarMovimiento(data: MovimientoInput): Promise<Result<{ sku: string; stock: number }>>;
  /** Devuelve el id del cliente (nuevo o editado). */
  guardarCliente(id: string | null, data: ClienteInput): Promise<Result<string>>;
  guardarProveedor(id: string | null, data: ProveedorInput): Promise<Result>;
  crearCotizacion(cliId: string, lines: CartLine[], notas: string): Promise<Result<{ id: string; codigo: string }>>;
  cambiarEstadoCotizacion(id: string, accion: 'submit' | 'approve' | 'reject', motivo?: string): Promise<Result>;
  obtenerCotizacion(id: string): Promise<Result<Cotizacion>>;
  convertirCotizacion(id: string, terms: CondicionesPago): Promise<Result<{ ventaId: string; factura: string }>>;
  confirmarVenta(cliId: string, lines: CartLine[], terms: CondicionesPago): Promise<Result<{ ventaId: string; factura: string }>>;
  obtenerVenta(id: string): Promise<Result<Venta>>;
  /** Precio comercial (Administración / Gerencia: prices:write). */
  cambiarPrecio(productoId: string, precio: number, motivo: string): Promise<Result>;
  historialPrecios(productoId: string): Promise<Result<PrecioHistorial[]>>;
  anularVenta(id: string, motivo: string): Promise<Result>;
  registrarPago(ventaId: string, monto: number, metodo: 'Contado' | 'Transferencia', referencia: string): Promise<Result>;
  crearOrden(cliId: string, desc: string, tecnicoId: string | null): Promise<Result<string>>;
  asignarOrden(id: string, tecnicoId: string): Promise<Result>;
  iniciarOrden(id: string): Promise<Result>;
  completarOrden(id: string, resumen: string): Promise<Result>;
  facturarOrden(id: string, ventaId: string): Promise<Result>;
  cancelarOrden(id: string, motivo: string): Promise<Result>;
  /** Devuelve el código de la solicitud (SOL-000001). */
  cambiarEstadoConsulta(id: string, estado: EstadoConsulta): Promise<Result>;
  obtenerConsulta(id: string): Promise<Result<ConsultaWeb>>;
  /** Solicitud web → cotización precargada (la solicitud pasa a Cotizada y se conserva). */
  cotizarConsulta(id: string, data: { cliId?: string; lineas?: CartLine[]; notas?: string; borrador?: boolean }): Promise<Result<{ id: string; codigo: string }>>;

  /* ---------- Ficha de producto ---------- */
  fichaProducto(id: string): Promise<Result<FichaProducto>>;

  /* ---------- Compras y reabastecimiento ---------- */
  /** Crea (id null) o modifica un borrador; con ordenar=true queda pendiente de recibir. */
  guardarCompra(id: string | null, data: CompraInput, ordenar: boolean): Promise<Result<{ id: string; codigo: string }>>;
  /** Ya ordenada: solo fecha esperada y notas. */
  actualizarSeguimientoCompra(id: string, esperada: string | null, notas: string): Promise<Result>;
  ordenarCompra(id: string): Promise<Result>;
  recibirCompra(id: string, lineas: Array<{ lineaId: string; cant: number }>, notas: string): Promise<Result<{ recepcion: string; estado: Compra['estado'] }>>;
  cancelarCompra(id: string, motivo: string): Promise<Result>;
  eliminarCompra(id: string): Promise<Result>;
  obtenerCompra(id: string): Promise<Result<Compra>>;
  sugerenciasReposicion(incluirPospuestos: boolean): Promise<Result<{ items: SugerenciaReposicion[]; resumen: ResumenReposicion }>>;
  posponerReposicion(productoId: string, dias: number, motivo: string): Promise<Result>;
  reactivarReposicion(productoId: string): Promise<Result>;

  refresh(keys: RefreshKey[]): Promise<void>;
  /**
   * Ejecuta una operación de un módulo que trae sus propios datos (p. ej. Producción) y
   * recarga las colecciones indicadas, igual que las demás acciones del store.
   */
  ejecutar<T>(fn: () => Promise<T>, keys: RefreshKey[]): Promise<Result<T>>;
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
  /** Estado del canal de tiempo real (WebSocket). */
  realtime: RealtimeStatus;
}

export const StoreContext = createContext<StoreValue | null>(null);
