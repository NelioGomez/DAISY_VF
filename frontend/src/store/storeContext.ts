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
  TipoConsulta,
  MetodoPago,
  Moneda,
  OpcionesGarantia,
  OrdenServicio,
  PrecioHistorial,
  ResumenReposicion,
  Result,
  SessionUser,
  SugerenciaReposicion,
  Venta,
} from '../types';
import type { Unidad } from '../utils/units';

export interface ProductoInput {
  sku: string;
  /** '' = sin código de barras. */
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  /** URL/ruta pública de imagen; '' = sin imagen. */
  imagen: string;
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
  /** Garantía en días desde la venta; null = sin garantía. */
  garantiaDias: number | null;
}

/** Nueva orden de servicio (mejora n.° 60: puede estar en garantía o venir de una solicitud web). */
export interface OrdenInput {
  cliId: string;
  desc: string;
  tecnicoId: string | null;
  /** Qué cubre la garantía: un producto comprado (venta + producto) o un servicio anterior. */
  garantia?: { ventaId: string; productoId: string } | { ordenId: string } | null;
  /** Solicitud de servicio técnico o reclamo que se atiende con la orden (queda Cerrada). */
  solicitudId?: string | null;
  notas?: string;
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

/** Ajuste de inventario por conteo (las entradas y salidas llegan por compras, ventas y producción). */
export interface AjusteInput {
  prodId: string;
  /** Existencia contada en la ubicación. */
  nuevoStock: number;
  /** Dónde se contó (1 = bodega, 2 = sucursal). */
  ubicacionId: number;
  ref: string;
  /** Motivo (el servidor exige al menos 5 caracteres). */
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
  /** Devuelve el id del producto (el nuevo, si se creó). */
  guardarProducto(id: string | null, data: ProductoInput): Promise<Result<string>>;
  /** Sube la foto del producto o la quita (null). */
  fotoProducto(id: string, foto: Blob | null): Promise<Result>;
  cambiarEstadoProducto(id: string, activo: boolean): Promise<Result>;
  registrarAjuste(data: AjusteInput): Promise<Result<{ sku: string; stock: number }>>;
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
  crearOrden(data: OrdenInput): Promise<Result<{ id: string; codigo: string }>>;
  obtenerOrden(id: string): Promise<Result<OrdenServicio>>;
  /** Compras con garantía y servicios con garantía de trabajo del cliente. */
  opcionesGarantia(cliId: string): Promise<Result<OpcionesGarantia>>;
  asignarOrden(id: string, tecnicoId: string): Promise<Result>;
  iniciarOrden(id: string): Promise<Result>;
  /** diasGarantia: garantía del trabajo (por omisión 90 días; 0 = sin garantía). */
  completarOrden(id: string, resumen: string, diasGarantia?: number): Promise<Result>;
  facturarOrden(id: string, ventaId: string): Promise<Result>;
  cancelarOrden(id: string, motivo: string): Promise<Result>;
  /** Devuelve el código de la solicitud (SOL-000001). */
  cambiarEstadoConsulta(id: string, estado: EstadoConsulta): Promise<Result>;
  /** Corrige el motivo de una solicitud (mejora n.° 59). */
  cambiarTipoConsulta(id: string, tipo: TipoConsulta): Promise<Result>;
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
  recibirCompra(id: string, lineas: Array<{ lineaId: string; cant: number }>, notas: string, ubicacionId?: number): Promise<Result<{ recepcion: string; estado: Compra['estado'] }>>;
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
  /** Colecciones que fallaron en la última carga, con su mensaje (mejora n.° 29). */
  failed: Partial<Record<RefreshKey, string>>;
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
