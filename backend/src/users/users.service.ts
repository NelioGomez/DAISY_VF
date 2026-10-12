import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildPagination } from '../common/utils/pagination';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/user-password.dto';

const BCRYPT_ROUNDS = 12;

/** Campos públicos: nunca se devuelve passwordHash. */
const USER_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  role: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterUserDto) {
    const { page, limit, search, role, isActive } = filter;
    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(role && { role: { code: role } }),
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthUser, ip?: string) {
    const email = dto.email.toLowerCase();
    await this.assertUnique(dto.username, email);
    const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!role) throw new BadRequestException('El rol indicado no existe');

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          roleId: role.id,
        },
        select: USER_SELECT,
      });
      await this.audit.log({
        userId: actor.id,
        username: actor.username,
        module: 'users',
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        description: `Usuario ${user.username} creado con rol ${dto.role}`,
        ip,
      });
      return user;
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertUnique(dto.username, email);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);

    if (dto.role && id === actor.id && dto.role !== actor.role) {
      throw new ForbiddenException('No puede cambiar su propio rol');
    }

    const email = dto.email?.toLowerCase();
    if (email) await this.assertUnique(undefined, email, id);

    let roleId: string | undefined;
    if (dto.role) {
      const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
      if (!role) throw new BadRequestException('El rol indicado no existe');
      roleId = role.id;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(email !== undefined && { email }),
        ...(roleId !== undefined && { roleId }),
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'users',
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      description: `Usuario ${existing.username} modificado`,
      ip,
    });
    return user;
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    if (id === actor.id && !isActive) {
      throw new ForbiddenException('No puede desactivar su propia cuenta');
    }
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'users',
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'User',
      entityId: id,
      description: `Usuario ${user.username} ${isActive ? 'activado' : 'desactivado'}`,
      ip,
    });
    return user;
  }

  async changeOwnPassword(actor: AuthUser, dto: ChangePasswordDto, ip?: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { passwordHash: true },
    });

    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        message: 'No fue posible cambiar la contraseña',
        errors: [{ field: 'currentPassword', message: 'La contraseña actual es incorrecta' }],
      });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        message: 'No fue posible cambiar la contraseña',
        errors: [{ field: 'newPassword', message: 'La nueva contraseña debe ser distinta a la actual' }],
      });
    }

    await this.prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'users',
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: actor.id,
      description: 'El usuario cambió su contraseña',
      ip,
    });
  }

  async resetPassword(id: string, newPassword: string, actor: AuthUser, ip?: string): Promise<void> {
    const existing = await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'users',
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: id,
      description: `Contraseña de ${existing.username} restablecida por un administrador`,
      ip,
    });
  }

  /** Lanza 409 con el detalle por campo si el username o el correo ya existen. */
  private async assertUnique(username: string | undefined, email: string, excludeId?: string) {
    const clashes = await this.prisma.user.findMany({
      where: {
        ...(excludeId && { NOT: { id: excludeId } }),
        OR: [...(username ? [{ username }] : []), { email }],
      },
      select: { username: true, email: true },
    });

    const errors: { field: string; message: string }[] = [];
    if (username && clashes.some((u) => u.username === username)) {
      errors.push({ field: 'username', message: 'El usuario ya existe' });
    }
    if (clashes.some((u) => u.email === email)) {
      errors.push({ field: 'email', message: 'El correo ya está registrado' });
    }
    if (errors.length) {
      throw new ConflictException({ message: 'No fue posible guardar el usuario', errors });
    }
  }
}
