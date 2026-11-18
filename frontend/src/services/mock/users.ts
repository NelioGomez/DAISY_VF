/* =====================================================================
   Cuentas de prueba (solo para la capa simulada).
   El rol pertenece a la cuenta: el usuario ya no lo elige en el login.

   IMPORTANTE: en el backend las contraseñas se guardan con hash
   (argon2 o bcrypt) en la tabla de usuarios y se comparan en el servidor.
   Este archivo deja de usarse en cuanto exista POST /api/v1/auth/login.
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

export const DEMO_PASSWORD = 'Siven#2026';

/** Cuenta con correo real para probar la recuperación. */
export const RECOVERY_TEST_EMAIL = 'ngomezanderson@gmail.com';

export const MOCK_USERS: MockUser[] = [
  { username: 'admin', password: DEMO_PASSWORD, nombre: 'Administrador del sistema', correo: 'admin@norcor.example', role: 'admin', activo: true },
  { username: 'gerencia', password: DEMO_PASSWORD, nombre: 'Gerencia General', correo: 'gerencia@norcor.example', role: 'gerencia', activo: true },
  { username: 'jflores', password: DEMO_PASSWORD, nombre: 'Joshua Flores', correo: 'jflores@norcor.example', role: 'vendedor', activo: true },
  { username: 'ngomez', password: DEMO_PASSWORD, nombre: 'Nelio Gómez', correo: RECOVERY_TEST_EMAIL, role: 'inventario', activo: true },
  { username: 'eurcuyo', password: DEMO_PASSWORD, nombre: 'Ernesto Urcuyo', correo: 'eurcuyo@norcor.example', role: 'contabilidad', activo: true },
  { username: 'tecnico', password: DEMO_PASSWORD, nombre: 'Técnico OPI', correo: 'tecnico@norcor.example', role: 'tecnico', activo: true },
];
