import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { passwordPolicyErrors } from './password-policy';

/** Reglas (ver docs/recuperacion-contrasena.md); el frontend usa los mismos valores. */
export const RESET_RULES = {
  codeTtlMinutes: 10,
  tokenTtlMinutes: 10,
  maxAttempts: 5,
  resendSeconds: 60,
  maxRequestsPer15Min: 3,
} as const;

const BCRYPT_ROUNDS = 12;
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');
const minutesFromNow = (m: number): Date => new Date(Date.now() + m * 60_000);

/**
 * Recuperación de contraseña en 3 pasos para el personal interno:
 *   1. requestCode  → código de 6 dígitos por correo (solo se guarda su hash)
 *   2. verifyCode   → si coincide, entrega un permiso temporal (resetToken; se guarda su hash)
 *   3. resetPassword→ con ese permiso se fija la nueva contraseña
 * El paso 1 responde igual exista o no el correo, para no revelar qué cuentas existen.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async requestCode(email: string, ip?: string) {
    const response = { resendAfter: RESET_RULES.resendSeconds, expiresIn: RESET_RULES.codeTtlMinutes * 60 };
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, firstName: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) return response;

    const recent = await this.prisma.passwordResetCode.findMany({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0]?.createdAt.getTime() ?? 0;
    if (Date.now() - last < RESET_RULES.resendSeconds * 1000) {
      throw new HttpException('Espere un momento antes de pedir otro código.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= RESET_RULES.maxRequestsPer15Min) {
      throw new HttpException('Se pidieron demasiados códigos para este correo. Intente más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Un código nuevo invalida los anteriores que sigan abiertos.
      await tx.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetCode.create({
        data: {
          userId: user.id,
          sentTo: user.email,
          codeHash: sha256(code),
          expiresAt: minutesFromNow(RESET_RULES.codeTtlMinutes),
          requestIp: ip ?? null,
        },
      });
    });

    // Sin esperar el envío: así el tiempo de respuesta no delata si el correo existe.
    void this.mail.sendResetCode(user.email, user.firstName, code, RESET_RULES.codeTtlMinutes);
    await this.audit.log({
      userId: user.id,
      username: user.username,
      module: 'auth',
      action: 'PASSWORD_RESET_REQUEST',
      entity: 'User',
      entityId: user.id,
      description: 'Solicitud de recuperación de contraseña por correo',
      ip,
    });
    return response;
  }

  async verifyCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, username: true, isActive: true } });
    const entry = user?.isActive
      ? await this.prisma.passwordResetCode.findFirst({
          where: { userId: user.id, usedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, codeHash: true, attempts: true, expiresAt: true },
        })
      : null;
    if (!user || !entry || entry.expiresAt.getTime() < Date.now()) {
      throw new GoneException('El código venció. Pida uno nuevo.');
    }

    const matches = timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(entry.codeHash));
    if (!matches) {
      const attempts = entry.attempts + 1;
      const exhausted = attempts >= RESET_RULES.maxAttempts;
      await this.prisma.passwordResetCode.update({
        where: { id: entry.id },
        data: { attempts, ...(exhausted && { usedAt: new Date() }) },
      });
      if (exhausted) {
        throw new HttpException('Se agotaron los intentos para este código. Pida uno nuevo.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new BadRequestException({
        message: 'El código no coincide',
        errors: [{ field: 'remainingAttempts', message: String(RESET_RULES.maxAttempts - attempts) }],
      });
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.passwordResetCode.update({ where: { id: entry.id }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.create({
        data: {
          codeId: entry.id,
          userId: user.id,
          tokenHash: sha256(resetToken),
          expiresAt: minutesFromNow(RESET_RULES.tokenTtlMinutes),
        },
      });
    });
    return { resetToken, username: user.username };
  }

  async resetPassword(resetToken: string, newPassword: string, ip?: string) {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(resetToken) },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { id: true, username: true, firstName: true, email: true, passwordHash: true, isActive: true } },
      },
    });
    const user = token?.user;
    if (!token || !user || !user.isActive || token.usedAt || token.expiresAt.getTime() < Date.now()) {
      throw new GoneException('El tiempo para cambiar la contraseña terminó. Empiece de nuevo.');
    }

    const policy = passwordPolicyErrors(newPassword, user.username);
    if (policy.length) {
      throw new UnprocessableEntityException({
        message: 'La contraseña no cumple los requisitos',
        errors: policy.map((message) => ({ field: 'newPassword', message })),
      });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new ConflictException('Use una contraseña distinta de la anterior.');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // passwordChangedAt invalida todas las sesiones (JWT) abiertas con la contraseña anterior.
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), passwordChangedAt: now },
      });
      await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      await tx.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    });

    void this.mail.sendPasswordChanged(user.email, user.firstName);
    await this.audit.log({
      userId: user.id,
      username: user.username,
      module: 'auth',
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      description: 'Contraseña restablecida mediante recuperación por correo',
      ip,
    });
    return { username: user.username };
  }
}
