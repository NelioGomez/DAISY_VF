import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { passwordPolicyErrors } from '../auth/password-policy';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildPagination } from '../common/utils/pagination';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerAccountDto,
  FilterCustomerAccountDto,
  UpdateCustomerAccountDto,
} from './dto/customer-account.dto';

const BCRYPT_ROUNDS = 12;
const MODULE = 'customer-accounts';

/** Nunca se devuelve el hash de la contraseña. */
const ACCOUNT_SELECT = {
  id: true,
  email: true,
  contactName: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, ruc: true, isActive: true } },
  _count: { select: { inquiries: true } },
} as const;

/**
 * Cuentas del portal de clientes, vistas desde el panel de administración (mejora n.° 70).
 * El portal le dice al cliente «escríbanos y le ayudamos a recuperar el acceso» y, si su RUC ya
 * existe, «comuníquese para vincular su cuenta»: aquí el administrador hace ambas cosas.
 * Todas las acciones quedan en la auditoría (módulo customer-accounts).
 */
@Injectable()
export class CustomerAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(f: FilterCustomerAccountDto) {
    const { page, limit, search, isActive, customerId } = f;
    const where: Prisma.CustomerAccountWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
          { customer: { ruc: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.customerAccount.count({ where }),
      this.prisma.customerAccount.findMany({
        where,
        select: ACCOUNT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const a = await this.prisma.customerAccount.findUnique({ where: { id }, select: ACCOUNT_SELECT });
    if (!a) throw new NotFoundException('Cuenta del portal no encontrada');
    return a;
  }

  async create(dto: CreateCustomerAccountDto, actor: AuthUser, ip?: string) {
    this.assertPolicy(dto.password, 'password');
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { id: true, name: true, isActive: true } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (!customer.isActive) {
      throw new BadRequestException({ message: 'El cliente está inactivo', errors: [{ field: 'customerId', message: 'Active primero al cliente en «Clientes y proveedores»' }] });
    }
    await this.assertEmailFree(dto.email);
    try {
      const account = await this.prisma.customerAccount.create({
        data: {
          customerId: customer.id,
          email: dto.email,
          contactName: dto.contactName,
          phone: dto.phone ?? null,
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        },
        select: ACCOUNT_SELECT,
      });
      await this.log(actor, 'CREATE', account.id, `Cuenta del portal ${account.email} creada para el cliente «${customer.name}»`, ip);
      return account;
    } catch (error) {
      if (isUniqueViolation(error)) throw this.emailTaken();
      throw error;
    }
  }

  /** Correo de acceso, contacto y teléfono. Si el correo de la ficha del cliente era el mismo, también se actualiza. */
  async update(id: string, dto: UpdateCustomerAccountDto, actor: AuthUser, ip?: string) {
    const acc = await this.prisma.customerAccount.findUnique({
      where: { id },
      select: { email: true, contactName: true, phone: true, customerId: true, customer: { select: { email: true } } },
    });
    if (!acc) throw new NotFoundException('Cuenta del portal no encontrada');
    const email = dto.email !== undefined && dto.email !== acc.email ? dto.email : undefined;
    if (email) await this.assertEmailFree(email, id);

    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.customerAccount.update({
          where: { id },
          data: {
            ...(email && { email, emailVerifiedAt: null }),
            ...(dto.contactName !== undefined && { contactName: dto.contactName }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
          },
        });
        if (email && acc.customer.email && acc.customer.email.toLowerCase() === acc.email) {
          await tx.customer.update({ where: { id: acc.customerId }, data: { email } });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.emailTaken();
      throw error;
    }

    const cambios = [
      email && `correo ${acc.email} → ${email}`,
      dto.contactName !== undefined && dto.contactName !== acc.contactName && `contacto «${acc.contactName}» → «${dto.contactName}»`,
      dto.phone !== undefined && (dto.phone ?? null) !== acc.phone && `teléfono ${acc.phone ?? '—'} → ${dto.phone ?? '—'}`,
    ].filter(Boolean);
    await this.log(actor, 'UPDATE', id, `Cuenta del portal ${acc.email} modificada${cambios.length ? `: ${cambios.join('; ')}` : ' (sin cambios)'}`, ip);
    return this.findOne(id);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    const acc = await this.findOne(id);
    const updated = await this.prisma.customerAccount.update({ where: { id }, data: { isActive }, select: ACCOUNT_SELECT });
    await this.log(actor, isActive ? 'ACTIVATE' : 'DEACTIVATE', id, `Cuenta del portal ${acc.email} ${isActive ? 'activada' : 'desactivada'}`, ip);
    return updated;
  }

  /** Contraseña temporal puesta por el administrador; se cierran las sesiones abiertas del cliente. */
  async resetPassword(id: string, newPassword: string, actor: AuthUser, ip?: string): Promise<void> {
    const acc = await this.findOne(id);
    this.assertPolicy(newPassword, 'newPassword');
    await this.prisma.customerAccount.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), passwordChangedAt: new Date() },
    });
    await this.log(actor, 'RESET_PASSWORD', id, `Contraseña del portal de ${acc.email} restablecida por un administrador`, ip);
  }

  /** Cierra las sesiones abiertas del cliente sin cambiar su contraseña. */
  async revokeSessions(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const acc = await this.findOne(id);
    await this.prisma.customerAccount.update({ where: { id }, data: { passwordChangedAt: new Date() } });
    await this.log(actor, 'REVOKE_SESSIONS', id, `Sesiones del portal de ${acc.email} cerradas por un administrador`, ip);
  }

  // ───────────────────────── helpers ─────────────────────────

  private assertPolicy(password: string, field: string) {
    const errors = passwordPolicyErrors(password);
    if (errors.length) {
      throw new BadRequestException({ message: 'La contraseña no cumple la política', errors: errors.map((message) => ({ field, message })) });
    }
  }

  private async assertEmailFree(email: string, excludeId?: string) {
    const other = await this.prisma.customerAccount.findFirst({
      where: { email, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (other) throw this.emailTaken();
  }

  private emailTaken() {
    return new ConflictException({
      message: 'Ya existe una cuenta del portal con ese correo',
      errors: [{ field: 'email', message: 'Ese correo ya tiene otra cuenta del portal' }],
    });
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: MODULE,
      action,
      entity: 'CustomerAccount',
      entityId,
      description,
      ip,
    });
  }
}
