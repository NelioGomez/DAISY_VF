import { createContext } from 'react';
import type { LoginFailure } from '../services/auth/authService';
import type {
  CartLine, Cliente, Database, MetodoPago, Producto, Proveedor, Result, SessionUser, TipoMovimiento,
} from '../types';

export type ProductoInput = Omit<Producto, 'id' | 'activo'>;
export type ClienteInput = Omit<Cliente, 'id'>;
export type ProveedorInput = Omit<Proveedor, 'id'>;

export type LoginResult = { ok: true; user: SessionUser } | LoginFailure;
export type LogoutReason = 'manual' | 'idle';
export interface LogoutInfo {
  reason: LogoutReason;
  username: string;
}

export interface DataActions {
  registrarAuditoria(modulo: string, detalle: string): void;
  guardarProducto(id: string | null, data: ProductoInput): Result;
  registrarMovimiento(tipo: TipoMovimiento, prodId: string, cant: number, costo: number | null, ref: string): Result<Producto>;
  guardarCliente(id: string | null, data: ClienteInput): Result;
  guardarProveedor(id: string | null, data: ProveedorInput): Result;
  crearCotizacion(cliId: string, lines: CartLine[]): Result<string>;
  aprobarCotizacion(id: string): Result<string>;
  validarStockCotizacion(id: string): Result;
  confirmarVenta(cliId: string, metodo: MetodoPago, lines: CartLine[], cotId: string | null): Result<{ ventaId: string; factura: string }>;
  registrarPago(ventaId: string, monto: number, metodo: MetodoPago): Result<number>;
  crearOrden(cliente: string, desc: string, tecnico: string): Result<string>;
  avanzarOrden(id: string): Result<string>;
  cancelarOrden(id: string): Result<string>;
  crearConsulta(nombre: string, contacto: string, msg: string): Result;
  atenderConsulta(id: string): Result;
}

export interface StoreValue {
  db: Database;
  user: SessionUser | null;
  login(username: string, password: string): Promise<LoginResult>;
  logout(reason?: LogoutReason): void;
  /** Motivo del último cierre de sesión (para avisar en el login). */
  lastLogout: LogoutInfo | null;
  actions: DataActions;
}

export const StoreContext = createContext<StoreValue | null>(null);
