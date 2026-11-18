/* =====================================================================
   Canal de tiempo real (socket.io) con la API.
   - Se autentica con el mismo JWT de la sesión.
   - El servidor solo envía; el cliente escucha:
       change          → algo cambió en un módulo (venta, stock, cobro…)
       session-expired → el JWT venció
       unauthorized    → el token no es válido o el usuario fue desactivado
   - En desarrollo Vite reenvía /socket.io al backend (vite.config.ts).
   ===================================================================== */
import { io, type Socket } from 'socket.io-client';

/** Evento que envía el backend. El detalle solo llega a quien puede leer ese módulo. */
export interface ChangeEvent {
  module: string;
  action: string;
  at: string;
  entity?: string | null;
  entityId?: string | null;
  description?: string | null;
  username?: string | null;
  userId?: string | null;
}

export type RealtimeStatus = 'off' | 'connecting' | 'online' | 'offline';

interface ServerEvents {
  change: (e: ChangeEvent) => void;
  'session-expired': () => void;
  unauthorized: () => void;
}

export interface RealtimeHandlers {
  onChange(e: ChangeEvent): void;
  onStatus(s: RealtimeStatus): void;
  /** Volvió la conexión tras una caída: pudo perderse algún aviso. */
  onReconnect(): void;
  onSessionEnded(): void;
}

/** URL del servidor de sockets: la misma del sitio salvo que se indique otra. */
const WS_URL: string | undefined = import.meta.env.VITE_WS_URL || undefined;

let socket: Socket<ServerEvents> | null = null;
const listeners = new Set<(e: ChangeEvent) => void>();

export function connectRealtime(token: string, h: RealtimeHandlers): void {
  disconnectRealtime();
  h.onStatus('connecting');
  let wasOnline = false;

  const s: Socket<ServerEvents> = io(WS_URL ?? window.location.origin, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
  socket = s;

  s.on('connect', () => {
    h.onStatus('online');
    if (wasOnline) h.onReconnect();
    wasOnline = true;
  });
  s.on('disconnect', (reason) => {
    // "io server disconnect": lo cerró el servidor a propósito (token vencido o usuario
    // desactivado). Socket.IO no reintenta en ese caso, y no debe hacerlo.
    h.onStatus(reason === 'io client disconnect' ? 'off' : 'offline');
  });
  s.on('connect_error', () => h.onStatus('offline'));
  s.on('change', (e) => {
    h.onChange(e);
    listeners.forEach((fn) => fn(e));
  });
  s.on('session-expired', () => h.onSessionEnded());
  s.on('unauthorized', () => h.onSessionEnded());
}

export function disconnectRealtime(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/** Para componentes que quieren reaccionar a cambios (avisos, vistas abiertas). */
export function subscribeRealtime(fn: (e: ChangeEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
