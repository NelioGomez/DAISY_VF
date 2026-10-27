> **Estado: implementado** en el backend (`src/auth/password-reset.service.ts`, rama
> `feature/base-de-datos`). El contrato usa los mismos nombres de campo que el resto de la API:
> `{ email }`, `{ email, code }`, `{ resetToken, newPassword }`. Los modelos Prisma de abajo quedaron
> como `PasswordResetCode` y `PasswordResetToken` en `schema.prisma` (ver `backend/docs/base-de-datos.md`).

# Recuperación de contraseña — guía para el backend (NestJS)

El frontend ya tiene el flujo completo en `/recuperar` y hoy lo simula en
`frontend/src/services/auth/recoveryService.ts`. Para que el correo llegue de verdad,
el backend debe exponer estos tres endpoints y enviar el mensaje con la plantilla
`docs/correo-codigo-recuperacion.html`.

## Flujo

```
Paso 1  POST /api/v1/auth/forgot-password     { correo }
        → siempre 200 con el mismo mensaje (exista o no el correo)
        → si existe: genera código de 6 dígitos, guarda su hash y envía el correo

Paso 2  POST /api/v1/auth/verify-reset-code   { correo, codigo }
        → 200 { resetToken }   (token de un solo uso, vence en 10 min)
        → 400 código incorrecto (con intentos restantes) / 410 vencido / 429 sin intentos

Paso 3  POST /api/v1/auth/reset-password      { resetToken, nuevaContrasena }
        → 200 contraseña cambiada: invalida el token y las sesiones abiertas del usuario
        → 400 no cumple la política / 410 token vencido
```

Respuestas con el formato del proyecto: `{ success, message, data }`.

## Reglas de seguridad (deben cumplirse en el servidor)

| Regla | Valor | Por qué |
| --- | --- | --- |
| Respuesta del paso 1 | Idéntica exista o no el correo | No revelar qué correos tienen cuenta |
| Código | 6 dígitos con `crypto.randomInt` | Aleatorio criptográficamente seguro |
| Almacenamiento | Solo el **hash** del código (SHA-256) | Si se filtra la BD, el código no sirve |
| Vigencia del código | 10 minutos, un solo uso | Ventana corta de ataque |
| Intentos por código | 5; luego se invalida | Evita adivinar el código (10⁶ combinaciones) |
| Reenvío | 1 cada 60 s; máximo 3 por correo cada 15 min | Evita abuso del envío de correos |
| Token del paso 2 | Aleatorio de 32 bytes, guardado con hash, vence en 10 min | El paso 3 no acepta el código, solo el token |
| Política de contraseña | ≥10 caracteres, mayúscula, minúscula, número, símbolo, sin el usuario, distinta de la actual | La misma que valida el frontend (`utils/passwordPolicy.ts`) |
| Después del cambio | Cerrar sesiones activas, registrar en auditoría, enviar aviso "su contraseña cambió" | Si no fue el dueño, se entera |
| Límite por IP | `@nestjs/throttler` en los tres endpoints | Defensa adicional contra automatización |

## Modelo Prisma

```prisma
model PasswordResetCode {
  id         String    @id @default(uuid())
  usuarioId  String
  usuario    Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  codigoHash String
  intentos   Int       @default(0)
  expiraEn   DateTime
  usadoEn    DateTime?
  creadoEn   DateTime  @default(now())

  @@index([usuarioId])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  usuarioId String
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiraEn  DateTime
  usadoEn   DateTime?
  creadoEn  DateTime  @default(now())
}
```

Agregar en `Usuario`: `passwordResetCodes PasswordResetCode[]` y `passwordResetTokens PasswordResetToken[]`.

## Envío del correo

Dependencias: `npm i nodemailer` y `npm i -D @types/nodemailer`.

Variables en `backend/.env` (nunca en el repositorio):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=cuenta-remitente@gmail.com
SMTP_PASS=contraseña-de-aplicación-de-16-caracteres
MAIL_FROM="SIVEN <cuenta-remitente@gmail.com>"
```

Con Gmail se necesita la verificación en dos pasos activada y una **contraseña de
aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones). La contraseña
normal de Gmail no funciona por SMTP. Para pruebas, el correo de la cuenta `ngomez`
en la semilla debe ser `ngomezanderson@gmail.com`.

Copiar `docs/correo-codigo-recuperacion.html` a `backend/templates/`. Luego, `src/modules/mail/mail.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly template = readFileSync(join(process.cwd(), 'templates', 'correo-codigo-recuperacion.html'), 'utf8');

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow('SMTP_HOST'),
      port: Number(config.get('SMTP_PORT', 465)),
      secure: true,
      auth: { user: config.getOrThrow('SMTP_USER'), pass: config.getOrThrow('SMTP_PASS') },
    });
  }

  async sendResetCode(to: string, nombre: string, codigo: string, minutos: number): Promise<void> {
    const html = this.template
      .replaceAll('{{nombre}}', escapeHtml(nombre))
      .replaceAll('{{codigo}}', codigo)
      .replaceAll('{{minutos}}', String(minutos))
      .replaceAll('{{anio}}', String(new Date().getFullYear()));
    try {
      await this.transporter.sendMail({
        from: this.config.getOrThrow('MAIL_FROM'),
        to,
        subject: `Su código de SIVEN: ${codigo}`,
        text: `Su código para restablecer la contraseña es ${codigo}. Vence en ${minutos} minutos.`,
        html,
      });
    } catch (err) {
      // No se propaga al cliente: la respuesta del paso 1 debe ser siempre la misma.
      this.logger.error(`No se pudo enviar el código de recuperación: ${(err as Error).message}`);
    }
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
```

## Servicio de recuperación (núcleo)

`src/modules/auth/password-reset.service.ts`:

```ts
import { BadRequestException, GoneException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

const CODE_TTL_MIN = 10;
const TOKEN_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
const MAX_REQUESTS_15_MIN = 3;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const GENERIC = 'Si el correo pertenece a una cuenta, le enviamos un código.';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async requestCode(correo: string) {
    const user = await this.prisma.usuario.findFirst({ where: { correo: correo.toLowerCase(), estado: 'ACTIVO' } });
    if (!user) return { message: GENERIC };

    const since = new Date(Date.now() - 15 * 60_000);
    const recent = await this.prisma.passwordResetCode.findMany({
      where: { usuarioId: user.id, creadoEn: { gte: since } },
      orderBy: { creadoEn: 'desc' },
    });
    const tooSoon = recent[0] && Date.now() - recent[0].creadoEn.getTime() < RESEND_SECONDS * 1000;
    if (tooSoon || recent.length >= MAX_REQUESTS_15_MIN) {
      throw new HttpException('Espere un momento antes de pedir otro código.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction([
      // Un código nuevo invalida los anteriores.
      this.prisma.passwordResetCode.updateMany({ where: { usuarioId: user.id, usadoEn: null }, data: { usadoEn: new Date() } }),
      this.prisma.passwordResetCode.create({
        data: { usuarioId: user.id, codigoHash: sha256(codigo), expiraEn: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
      }),
    ]);
    await this.mail.sendResetCode(user.correo, user.nombres, codigo, CODE_TTL_MIN);
    await this.audit.log(user.id, 'Seguridad', 'Solicitud de recuperación de contraseña');
    return { message: GENERIC };
  }

  async verifyCode(correo: string, codigo: string) {
    const user = await this.prisma.usuario.findFirst({ where: { correo: correo.toLowerCase() } });
    const entry = user
      ? await this.prisma.passwordResetCode.findFirst({ where: { usuarioId: user.id, usadoEn: null }, orderBy: { creadoEn: 'desc' } })
      : null;
    if (!user || !entry || entry.expiraEn < new Date()) throw new GoneException('El código venció. Pida uno nuevo.');

    const ok = timingSafeEqual(Buffer.from(sha256(codigo)), Buffer.from(entry.codigoHash));
    if (!ok) {
      const intentos = entry.intentos + 1;
      await this.prisma.passwordResetCode.update({
        where: { id: entry.id },
        data: { intentos, ...(intentos >= MAX_ATTEMPTS ? { usadoEn: new Date() } : {}) },
      });
      if (intentos >= MAX_ATTEMPTS) throw new HttpException('Se agotaron los intentos. Pida un código nuevo.', HttpStatus.TOO_MANY_REQUESTS);
      throw new BadRequestException({ message: 'El código no coincide.', remainingAttempts: MAX_ATTEMPTS - intentos });
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.update({ where: { id: entry.id }, data: { usadoEn: new Date() } }),
      this.prisma.passwordResetToken.create({
        data: { usuarioId: user.id, tokenHash: sha256(resetToken), expiraEn: new Date(Date.now() + TOKEN_TTL_MIN * 60_000) },
      }),
    ]);
    return { resetToken, username: user.username };
  }

  async resetPassword(resetToken: string, nuevaContrasena: string) {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(resetToken) }, include: { usuario: true } });
    if (!token || token.usadoEn || token.expiraEn < new Date()) throw new GoneException('El tiempo para cambiar la contraseña terminó.');
    // Validar aquí la misma política que el frontend (DTO con class-validator + chequeo de username).
    if (await argon2.verify(token.usuario.passwordHash, nuevaContrasena)) {
      throw new BadRequestException('Use una contraseña distinta de la anterior.');
    }
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: token.usuarioId }, data: { passwordHash: await argon2.hash(nuevaContrasena) } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usadoEn: new Date() } }),
    ]);
    // Aquí: invalidar sesiones/refresh tokens del usuario y enviar aviso de cambio.
    await this.audit.log(token.usuarioId, 'Seguridad', 'Contraseña restablecida mediante recuperación');
    return { username: token.usuario.username };
  }
}
```

Los nombres de campos (`nombres`, `estado`, `passwordHash`) siguen el módulo de usuarios
del prompt maestro; ajustarlos si el esquema final usa otros.

## Conectar el frontend

En `frontend/src/services/auth/recoveryService.ts`, reemplazar el cuerpo de las tres
funciones por llamadas a `api.post(...)` de `services/api/client.ts`, manteniendo los
mismos tipos de respuesta. Quitar `devCode`: el código solo debe viajar por correo.
