import { createContext } from 'react';
import type { CuentaCliente, LineaLista, ProductoPublico } from '../../types';
import type { PortalSession, RegistroInput } from '../../services/portal/portalService';

export interface CustomerValue {
  /** Cuenta del cliente con sesión iniciada (null = visitante). */
  cuenta: CuentaCliente | null;
  token: string | null;
  /** true mientras se valida una sesión guardada. */
  restaurando: boolean;
  ingresar(email: string, password: string): Promise<void>;
  registrar(d: RegistroInput): Promise<void>;
  /** Reemplaza la sesión (p. ej. tras cambiar la contraseña) o actualiza la cuenta. */
  aplicarSesion(s: PortalSession): void;
  actualizarCuenta(c: CuentaCliente): void;
  /** Cierra la sesión. "manual": la cerró el cliente; "expired": venció o el servidor la rechazó. */
  salir(motivo?: MotivoSalida): void;
  /** Por qué terminó la última sesión (decide a dónde redirigir las páginas protegidas). */
  salida: MotivoSalida | null;
}

export type MotivoSalida = 'manual' | 'expired';

export interface QuoteListValue {
  lineas: LineaLista[];
  unidades: number;
  agregar(p: ProductoPublico, cant?: number): void;
  cambiar(id: string, patch: Partial<Pick<LineaLista, 'cant' | 'nota'>>): void;
  quitar(id: string): void;
  vaciar(): void;
  /** Abre el panel de la lista (se usa al volver del inicio de sesión). */
  abierta: boolean;
  setAbierta(v: boolean): void;
}

/** Estado que viaja hacia "Iniciar sesión" / "Crear cuenta" del portal. */
export interface CustomerRedirectState {
  /** Ruta a la que volver después de iniciar sesión o crear la cuenta. */
  from?: string;
  /** Reabrir la lista al volver. */
  abrirLista?: boolean;
  /** La sesión anterior venció. */
  vencida?: boolean;
}

export const CustomerContext = createContext<CustomerValue | null>(null);
export const QuoteListContext = createContext<QuoteListValue | null>(null);
