import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nodemailer from 'nodemailer';

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/**
 * Envío de correos (SMTP). Si SMTP_HOST no está configurado:
 * - en desarrollo, el código se muestra en la terminal del backend para poder probar;
 * - en producción, solo se registra el error (nunca el código).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Correo');
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly isProduction: boolean;
  private template: string | null = null;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.from = config.get<string>('MAIL_FROM') || 'SIVEN · NORCOR <no-responder@norcor.local>';
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT') ?? 465),
          secure: String(config.get('SMTP_SECURE') ?? 'true') !== 'false',
          auth: { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') },
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** Nunca lanza: la respuesta del paso 1 de recuperación debe ser la misma ocurra lo que ocurra. */
  async sendResetCode(to: string, name: string, code: string, minutes: number): Promise<void> {
    if (!this.transporter) {
      if (this.isProduction) this.logger.error(`SMTP no configurado: no se pudo enviar el código a ${to}`);
      else this.logger.warn(`SMTP no configurado (desarrollo). Código de recuperación para ${to}: ${code} · vence en ${minutes} min`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `Su código de SIVEN: ${code}`,
        text: `Hola ${name}. Su código para restablecer la contraseña es ${code}. Vence en ${minutes} minutos. Si no lo pidió, ignore este correo.`,
        html: this.render({ nombre: escapeHtml(name), codigo: code, minutos: String(minutes), anio: String(new Date().getFullYear()) }),
      });
      this.logger.log(`Código de recuperación enviado a ${to}`);
    } catch (err) {
      this.logger.error(`No se pudo enviar el código a ${to}: ${(err as Error).message}`);
    }
  }

  /** Aviso posterior: si no fue el dueño de la cuenta, se entera. */
  async sendPasswordChanged(to: string, name: string): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Su contraseña de SIVEN cambió',
        text: `Hola ${name}. La contraseña de su cuenta de SIVEN se cambió. Si no fue usted, avise de inmediato al administrador.`,
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el aviso de cambio a ${to}: ${(err as Error).message}`);
    }
  }

  private render(vars: Record<string, string>): string {
    this.template ??= readFileSync(join(process.cwd(), 'templates', 'correo-codigo-recuperacion.html'), 'utf8');
    return Object.entries(vars).reduce((html, [k, v]) => html.replaceAll(`{{${k}}}`, v), this.template);
  }
}
