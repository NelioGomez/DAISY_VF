/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ruta de la API vista desde el navegador (por defecto /api/v1, servida por el proxy de Vite). */
  readonly VITE_API_URL?: string;
  /** Destino del proxy de Vite en desarrollo (por defecto http://localhost:3000). */
  readonly VITE_BACKEND_URL?: string;
  /** Servidor de WebSocket si no es el mismo sitio (por defecto se usa el proxy /socket.io). */
  readonly VITE_WS_URL?: string;
  /** "true" muestra las cuentas de prueba en el login fuera de desarrollo. */
  readonly VITE_DEMO_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
