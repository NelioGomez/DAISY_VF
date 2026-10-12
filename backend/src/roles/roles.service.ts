import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    return roles.map((r) => this.toDto(r));
  }

  findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, description: true },
    });
  }

  /** Reemplaza el conjunto de permisos de un rol (todo o nada). */
  async setPermissions(roleId: string, codes: string[], actor: AuthUser, ip?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.code === UserRole.ADMIN) {
      throw new ForbiddenException('El rol Administrador tiene acceso total y no puede modificarse');
    }

    const found = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const unknown = codes.filter((c) => !found.some((p) => p.code === c));
    if (unknown.length) {
      throw new BadRequestException({
        message: 'Hay permisos que no existen',
        errors: unknown.map((c) => ({ field: 'permissions', message: `Permiso desconocido: ${c}` })),
      });
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: found.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'roles',
      action: 'SET_PERMISSIONS',
      entity: 'Role',
      entityId: roleId,
      description: `Permisos del rol ${role.code} actualizados (${found.length})`,
      ip,
    });

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    return this.toDto(updated);
  }

  private toDto(r: {
    id: string;
    code: UserRole;
    name: string;
    description: string | null;
    permissions: { permission: { code: string } }[];
  }) {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((rp) => rp.permission.code).sort(),
    };
  }
}
