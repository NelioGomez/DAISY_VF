/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ruta de la API vista desde el navegador (por defecto /api/v1, servida por el proxy de Vite). */
  readonly VITE_API_URL?: string;
  /** Destino del proxy de Vite en desarrollo (por defecto http://localhost:3000). */
  readonly VITE_BACKEND_URL?: string;
  /** "true" muestra las cuentas de prueba en el login fuera de desarrollo. */
  readonly VITE_DEMO_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
