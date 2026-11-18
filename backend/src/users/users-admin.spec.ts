import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const actor = { id: 'admin-id', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const existing = {
  id: 'u2', username: 'jflores', firstName: 'Joshua', lastName: 'Flores', email: 'jflores@norcor.example',
  isActive: true, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, role: { id: 'r1', code: 'SELLER', name: 'Vendedor' },
};

function build() {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(({ data }) => Promise.resolve({ ...existing, ...data })),
    },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'r9', code: 'ADMIN' }) },
  };
  const audit = { log: jest.fn() };
  return { prisma, audit, service: new UsersService(prisma as never, audit as never) };
}

describe('UsersService · control completo del administrador (mejora n.° 69)', () => {
  it('cambia el usuario y el correo, y la auditoría dice qué cambió', async () => {
    const { prisma, audit, service } = build();
    await service.update('u2', { username: 'joshua.f', email: 'Joshua@Norcor.example' } as never, actor);
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ username: 'joshua.f', email: 'joshua@norcor.example' });
    const desc = audit.log.mock.calls[0][0].description as string;
    expect(desc).toContain('usuario jflores → joshua.f');
    expect(desc).toContain('correo jflores@norcor.example → joshua@norcor.example');
  });

  it('usuario o correo de otra persona → 409 con el campo', async () => {
    const { prisma, service } = build();
    prisma.user.findMany.mockResolvedValue([{ username: 'tlopez', email: 'otro@norcor.example' }]);
    const err = await service.update('u2', { username: 'tlopez' } as never, actor).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors).toEqual([{ field: 'username', message: 'Ese usuario ya lo tiene otra persona' }]);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ NOT: { id: 'u2' }, OR: [{ username: 'tlopez' }] });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('dejar el mismo usuario y correo no busca duplicados ni los reescribe', async () => {
    const { prisma, service } = build();
    await service.update('u2', { username: 'jflores', email: 'jflores@norcor.example', firstName: 'Josh' } as never, actor);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ firstName: 'Josh' });
  });

  it('el administrador puede cambiar su propio usuario, pero no su rol', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ ...existing, id: 'admin-id', username: 'admin', role: { id: 'r9', code: 'ADMIN', name: 'Administrador' } });
    await service.update('admin-id', { username: 'administrador' } as never, actor);
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ username: 'administrador' });
    await expect(service.update('admin-id', { role: 'SELLER' } as never, actor)).rejects.toThrow(ForbiddenException);
  });

  it('cerrar sesiones invalida los tokens anteriores; no en la propia cuenta', async () => {
    const { prisma, audit, service } = build();
    await service.revokeSessions('u2', actor);
    expect(prisma.user.update.mock.calls[0][0].data.passwordChangedAt).toBeInstanceOf(Date);
    expect(audit.log.mock.calls[0][0].action).toBe('REVOKE_SESSIONS');
    await expect(service.revokeSessions('admin-id', actor)).rejects.toThrow(ForbiddenException);
  });

  it('el DTO valida el formato del usuario y lo pasa a minúsculas', async () => {
    const ok = plainToInstance(UpdateUserDto, { username: '  M.Lopez ' });
    expect(await validate(ok)).toHaveLength(0);
    expect(ok.username).toBe('m.lopez');
    const bad = plainToInstance(UpdateUserDto, { username: 'mal usuario!' });
    expect((await validate(bad))[0].property).toBe('username');
  });
});
