/* =====================================================================
   Cuentas de prueba (solo para la capa simulada).
   El rol pertenece a la cuenta: el usuario ya no lo elige en el login.

   IMPORTANTE: en el backend las contraseñas se guardan con hash
   (argon2 o bcrypt) en la tabla de usuarios y se comparan en el servidor.
   Este archivo deja de usarse en cuanto exista POST /auth/login.
   ===================================================================== */
import type { RoleKey } from '../../types';

export interface MockUser {
  username: string;
  password: string;
  role: RoleKey;
  activo: boolean;
}

export const DEMO_PASSWORD = 'Siven#2026';

export const MOCK_USERS: MockUser[] = [
  { username: 'admin', password: DEMO_PASSWORD, role: 'admin', activo: true },
  { username: 'gerencia', password: DEMO_PASSWORD, role: 'gerencia', activo: true },
  { username: 'jflores', password: DEMO_PASSWORD, role: 'vendedor', activo: true },
  { username: 'ngomez', password: DEMO_PASSWORD, role: 'inventario', activo: true },
  { username: 'eurcuyo', password: DEMO_PASSWORD, role: 'contabilidad', activo: true },
  { username: 'tecnico', password: DEMO_PASSWORD, role: 'tecnico', activo: true },
];
