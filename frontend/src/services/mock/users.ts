/* =====================================================================
   Cuentas para la SIMULACIÓN de recuperación de contraseña.
   Solo se usan si el backend todavía no expone /auth/forgot-password y
   la app corre en modo desarrollo. Reflejan la semilla de demostración
   del backend (scripts/seed-demo.mjs). El inicio de sesión real ya no
   usa este archivo.
   ===================================================================== */
import type { RoleKey } from '../../types';

export interface MockUser {
  username: string;
  /** Mutable: la recuperación de contraseña la reemplaza en memoria. */
  password: string;
  nombre: string;
  correo: string;
  role: RoleKey;
  activo: boolean;
}

export const DEMO_PASSWORD = 'Siven2026demo';

/** Cuenta con correo real para probar la recuperación. */
export const RECOVERY_TEST_EMAIL = 'ngomezanderson@gmail.com';

export const MOCK_USERS: MockUser[] = [
  { username: 'admin', password: DEMO_PASSWORD, nombre: 'Administrador del sistema', correo: 'admin@norcor.local', role: 'admin', activo: true },
  { username: 'gerencia', password: DEMO_PASSWORD, nombre: 'Gerencia General', correo: 'gerencia@norcor.example', role: 'gerencia', activo: true },
  { username: 'jflores', password: DEMO_PASSWORD, nombre: 'Joshua Flores', correo: 'jflores@norcor.example', role: 'vendedor', activo: true },
  { username: 'ngomez', password: DEMO_PASSWORD, nombre: 'Nelio Gómez', correo: RECOVERY_TEST_EMAIL, role: 'inventario', activo: true },
  { username: 'eurcuyo', password: DEMO_PASSWORD, nombre: 'Ernesto Urcuyo', correo: 'eurcuyo@norcor.example', role: 'contabilidad', activo: true },
  { username: 'tlopez', password: DEMO_PASSWORD, nombre: 'Luis López', correo: 'tlopez@norcor.example', role: 'tecnico', activo: true },
];
