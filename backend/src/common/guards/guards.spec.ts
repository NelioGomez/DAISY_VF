import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client';
import type { AuthUser } from '../interfaces/auth-user.interface';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

function ctxWith(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function reflectorReturning(value: unknown): Reflector {
  return { getAllAndOverride: jest.fn().mockReturnValue(value) } as unknown as Reflector;
}

const seller: AuthUser = {
  id: 's1',
  username: 'vendedor',
  role: UserRole.SELLER,
  permissions: ['customers:read', 'sales:write'],
};
const admin: AuthUser = { id: 'a1', username: 'admin', role: UserRole.ADMIN, permissions: [] };

describe('PermissionsGuard', () => {
  it('permite si la ruta no exige permisos', () => {
    expect(new PermissionsGuard(reflectorReturning(undefined)).canActivate(ctxWith(seller))).toBe(true);
  });

  it('permite si el usuario tiene todos los permisos', () => {
    const guard = new PermissionsGuard(reflectorReturning(['customers:read', 'sales:write']));
    expect(guard.canActivate(ctxWith(seller))).toBe(true);
  });

  it('acceso sin permisos → 403', () => {
    const guard = new PermissionsGuard(reflectorReturning(['users:write']));
    expect(() => guard.canActivate(ctxWith(seller))).toThrow(ForbiddenException);
  });

  it('exige TODOS los permisos, no solo uno', () => {
    const guard = new PermissionsGuard(reflectorReturning(['customers:read', 'users:write']));
    expect(() => guard.canActivate(ctxWith(seller))).toThrow(ForbiddenException);
  });

  it('el Administrador pasa siempre', () => {
    const guard = new PermissionsGuard(reflectorReturning(['cualquier:cosa']));
    expect(guard.canActivate(ctxWith(admin))).toBe(true);
  });
});

describe('RolesGuard', () => {
  it('permite si el rol está en la lista', () => {
    const guard = new RolesGuard(reflectorReturning([UserRole.SELLER, UserRole.ADMIN]));
    expect(guard.canActivate(ctxWith(seller))).toBe(true);
  });

  it('rechaza si el rol no está en la lista → 403', () => {
    const guard = new RolesGuard(reflectorReturning([UserRole.ACCOUNTING]));
    expect(() => guard.canActivate(ctxWith(seller))).toThrow(ForbiddenException);
  });
});
