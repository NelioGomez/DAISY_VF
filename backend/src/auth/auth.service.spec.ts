import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const password = 'Secret123';
  let passwordHash: string;

  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('token-firmado'),
    decode: jest.fn().mockReturnValue({ iat: 1000, exp: 1900 }),
  };
  const audit = { log: jest.fn() };

  let service: AuthService;

  const dbUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    username: 'admin',
    passwordHash,
    firstName: 'Ada',
    lastName: 'Admin',
    email: 'admin@norcor.local',
    isActive: true,
    role: { code: 'ADMIN', permissions: [{ permission: { code: 'users:read' } }] },
    ...overrides,
  });

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as never, jwt as never, audit as never);
  });

  it('login correcto: devuelve token, expiración y permisos, sin hash', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());

    const res = await service.login({ username: 'admin', password }, '127.0.0.1');

    expect(res.accessToken).toBe('token-firmado');
    expect(res.expiresIn).toBe(900);
    expect(res.user.role).toBe('ADMIN');
    expect(res.user.permissions).toEqual(['users:read']);
    expect(JSON.stringify(res)).not.toContain(passwordHash);
    expect(prisma.user.update).toHaveBeenCalled(); // lastLoginAt
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN' }));
  });

  it('el JWT solo lleva sub, username y role', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());
    await service.login({ username: 'admin', password });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', username: 'admin', role: 'ADMIN' });
  });

  it('login incorrecto: contraseña errónea → 401 y auditoría', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());
    await expect(service.login({ username: 'admin', password: 'Otra1234' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('usuario inexistente → 401 con el mismo mensaje genérico', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ username: 'nadie', password })).rejects.toThrow(
      'Credenciales inválidas',
    );
  });

  it('usuario inactivo con contraseña correcta → 403', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));
    await expect(service.login({ username: 'admin', password })).rejects.toThrow(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
