import { ConflictException, ForbiddenException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { passwordPolicyErrors } from '../auth/password-policy';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMER_TOKEN_TYPE, type CustomerJwtPayload, type PortalCustomer } from './customer-auth.guard';
import { ChangeCustomerPasswordDto, CustomerLoginDto, RegisterCustomerDto, UpdateCustomerProfileDto } from './dto/portal.dto';

const BCRYPT_ROUNDS = 12;

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  contactName: true,
  phone: true,
  createdAt: true,
  lastLoginAt: true,
  customer: { select: { id: true, name: true, ruc: true, phone: true, address: true } },
} as const;

/**
 * Autenticación del portal de clientes (mejora n.° 42): registro, inicio de sesión y perfil.
 * Es independiente del login del personal: otra tabla (customer_accounts), otro tipo de token y
 * ninguna pantalla interna. Un cliente nuevo siempre crea su propia ficha de cliente; si el RUC ya
 * existe, la vinculación la hace NORCOR (así nadie ve las cotizaciones de otra empresa).
 */
@Injectable()
export class PortalAuthService {
  /** Hash de relleno: el tiempo de respuesta no revela si el correo existe. */
  private readonly dummyHash = bcrypt.hashSync('relleno-portal-clientes', BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterCustomerDto, ip?: string) {
    const policy = passwordPolicyErrors(dto.password);
    if (policy.length) {
      throw new UnprocessableEntityException({
        message: 'La contraseña no cumple la política',
        errors: policy.map((message) => ({ field: 'password', message })),
      });
    }
    if (await this.prisma.customerAccount.findUnique({ where: { email: dto.email }, select: { id: true } })) {
      throw this.emailTaken();
    }
    if (dto.ruc && (await this.prisma.customer.findUnique({ where: { ruc: dto.ruc }, select: { id: true } }))) {
      throw new ConflictException({
        message: 'Ya existe un cliente con ese RUC',
        errors: [{ field: 'ruc', message: 'Ese RUC ya está registrado en NORCOR. Comuníquese con nosotros para vincular su cuenta.' }],
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let account: { id: string; customerId: string };
    try {
      account = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const customer = await tx.customer.create({
          data: {
            name: dto.companyName,
            ruc: dto.ruc ?? null,
            contactName: dto.contactName,
            phone: dto.phone ?? null,
            email: dto.email,
          },
          select: { id: true },
        });
        return tx.customerAccount.create({
          data: {
            customerId: customer.id,
            email: dto.email,
            passwordHash,
            contactName: dto.contactName,
            phone: dto.phone ?? null,
            lastLoginAt: new Date(),
          },
          select: { id: true, customerId: true },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.emailTaken();
      throw error;
    }

    // Va al módulo de clientes para que el personal vea al nuevo cliente en tiempo real.
    await this.audit.log({
      module: 'customers',
      action: 'PORTAL_REGISTER',
      entity: 'Customer',
      entityId: account.customerId,
      description: `Nuevo cliente desde el portal: ${dto.companyName} (${dto.email})`,
      ip,
    });
    return this.session(account.id, account.customerId);
  }

  async login(dto: CustomerLoginDto, ip?: string) {
    const account = await this.prisma.customerAccount.findUnique({
      where: { email: dto.email },
      select: { id: true, customerId: true, passwordHash: true, isActive: true, customer: { select: { isActive: true } } },
    });
    const ok = await bcrypt.compare(dto.password, account?.passwordHash ?? this.dummyHash);
    if (!account || !ok) {
      await this.audit.log({ module: 'portal', action: 'LOGIN_FAILED', description: `Intento fallido en el portal (${dto.email})`, ip });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    if (!account.isActive || !account.customer.isActive) throw new ForbiddenException('Su cuenta está desactivada. Comuníquese con NORCOR.');

    await this.prisma.customerAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ module: 'portal', action: 'LOGIN', entity: 'CustomerAccount', entityId: account.id, description: `Inicio de sesión en el portal (${dto.email})`, ip });
    return this.session(account.id, account.customerId);
  }

  async me(c: PortalCustomer) {
    return this.account(c.accountId);
  }

  async updateProfile(c: PortalCustomer, dto: UpdateCustomerProfileDto) {
    await this.prisma.customerAccount.update({
      where: { id: c.accountId },
      data: {
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });
    return this.account(c.accountId);
  }

  /** Cambia la contraseña y cierra las otras sesiones; devuelve una sesión nueva para este navegador. */
  async changePassword(c: PortalCustomer, dto: ChangeCustomerPasswordDto, ip?: string) {
    const acc = await this.prisma.customerAccount.findUniqueOrThrow({ where: { id: c.accountId }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(dto.currentPassword, acc.passwordHash))) {
      throw new UnprocessableEntityException({ message: 'Contraseña actual incorrecta', errors: [{ field: 'currentPassword', message: 'La contraseña actual no coincide' }] });
    }
    const policy = passwordPolicyErrors(dto.newPassword);
    if (policy.length) {
      throw new UnprocessableEntityException({ message: 'La contraseña no cumple la política', errors: policy.map((message) => ({ field: 'newPassword', message })) });
    }
    if (await bcrypt.compare(dto.newPassword, acc.passwordHash)) {
      throw new ConflictException({ message: 'La nueva contraseña es igual a la actual', errors: [{ field: 'newPassword', message: 'Elija una contraseña distinta' }] });
    }
    // Un milisegundo atrás: el token nuevo (emitido después) sigue siendo válido.
    await this.prisma.customerAccount.update({
      where: { id: c.accountId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS), passwordChangedAt: new Date(Date.now() - 1) },
    });
    await this.audit.log({ module: 'portal', action: 'CHANGE_PASSWORD', entity: 'CustomerAccount', entityId: c.accountId, description: `Cambio de contraseña en el portal (${c.email})`, ip });
    return this.session(c.accountId, c.customerId);
  }

  // ───────────────────────── helpers ─────────────────────────

  private async session(accountId: string, customerId: string) {
    const payload: CustomerJwtPayload = { sub: accountId, cid: customerId, typ: CUSTOMER_TOKEN_TYPE, iatMs: Date.now() };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode<{ iat: number; exp: number }>(accessToken);
    return { accessToken, tokenType: 'Bearer', expiresIn: decoded.exp - decoded.iat, account: await this.account(accountId) };
  }

  private async account(id: string) {
    const a = await this.prisma.customerAccount.findUniqueOrThrow({ where: { id }, select: ACCOUNT_SELECT });
    return a;
  }

  private emailTaken() {
    return new ConflictException({
      message: 'Ya existe una cuenta con ese correo',
      errors: [{ field: 'email', message: 'Ese correo ya tiene cuenta: inicie sesión' }],
    });
  }
}
