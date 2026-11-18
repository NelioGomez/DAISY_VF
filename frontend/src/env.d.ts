/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API REST de NestJS, p. ej. http://localhost:3000/api */
  readonly VITE_API_URL?: string;
  /** "true" muestra las cuentas de prueba en el login fuera de desarrollo. */
  readonly VITE_DEMO_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
