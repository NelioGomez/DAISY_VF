import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/** La ruta exige que el usuario tenga AL MENOS UNO de estos roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
