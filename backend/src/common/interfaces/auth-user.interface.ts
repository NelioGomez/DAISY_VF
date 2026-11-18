import type { UserRole } from '../../generated/prisma/client';

/** Identidad autenticada, construida por el servidor a partir de la base de datos. */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  permissions: string[];
}

/** Contenido mínimo del JWT (iat y exp los agrega la firma). */
export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  /** Momento exacto de emisión (ms): permite invalidar sesiones al cambiar la contraseña. */
  iatMs?: number;
}