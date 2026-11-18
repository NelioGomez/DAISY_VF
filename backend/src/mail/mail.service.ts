import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nodemailer from 'nodemailer';

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** API HTTP de Brevo para correos transaccionales (puerto 443: funciona donde SMTP está bloqueado). */
export const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10_000;

interface Sender {
  name?: string;
  email: string;
}

interface OutgoingMail {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
}

/** "SIVEN · NORCOR <correo@dominio>" → { name, email }. Un correo suelto también es válido. */
export function parseSender(from: string): Sender {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1].trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

/**
 * Envío de correos. Proveedor, en este orden:
 * 1. BREVO_API_KEY → API HTTP de Brevo (Railway Hobby y Render gratis bloquean SMTP saliente).
 * 2. SMTP_HOST     → SMTP con Nodemailer (por ejemplo, Gmail en desarrollo local).
 * 3. Ninguno: en desarrollo el código se muestra en la terminal del backend para poder probar;
 *    en producción solo se registra el error (nunca el código).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Correo');
  private readonly brevoKey: string | null;
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly isProduction: boolean;
  private template: string | null = null;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.from = config.get<string>('MAIL_FROM') || 'SIVEN · NORCOR <no-responder@norcor.local>';
    this.brevoKey = config.get<string>('BREVO_API_KEY')?.trim() || null;
    this.transporter =
      !this.brevoKey && host
        ? nodemailer.createTransport({
            host,
            port: Number(config.get('SMTP_PORT') ?? 465),
            secure: String(config.get('SMTP_SECURE') ?? 'true') !== 'false',
            auth: { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') },
          })
        : null;
    this.logger.log(`Proveedor de correo: ${this.provider ?? 'ninguno'}`);
  }

  /** 'brevo' | 'smtp' | null (sin proveedor configurado). */
  get provider(): 'brevo' | 'smtp' | null {
    if (this.brevoKey) return 'brevo';
    return this.transporter ? 'smtp' : null;
  }

  get isConfigured(): boolean {
    return this.provider !== null;
  }

  /** Nunca lanza: la respuesta del paso 1 de recuperación debe ser la misma ocurra lo que ocurra. */
  async sendResetCode(to: string, name: string, code: string, minutes: number): Promise<void> {
    if (!this.isConfigured) {
      if (this.isProduction) this.logger.error(`Correo no configurado: no se pudo enviar el código a ${to}`);
      else this.logger.warn(`Correo no configurado (desarrollo). Código de recuperación para ${to}: ${code} · vence en ${minutes} min`);
      return;
    }
    try {
      await this.deliver({
        to,
        toName: name,
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
    if (!this.isConfigured) return;
    try {
      await this.deliver({
        to,
        toName: name,
        subject: 'Su contraseña de SIVEN cambió',
        text: `Hola ${name}. La contraseña de su cuenta de SIVEN se cambió. Si no fue usted, avise de inmediato al administrador.`,
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el aviso de cambio a ${to}: ${(err as Error).message}`);
    }
  }

  private async deliver(mail: OutgoingMail): Promise<void> {
    if (this.brevoKey) return this.sendWithBrevo(this.brevoKey, mail);
    if (!this.transporter) throw new Error('Sin proveedor de correo');
    await this.transporter.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  }

  private async sendWithBrevo(apiKey: string, mail: OutgoingMail): Promise<void> {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [mail.toName ? { email: mail.to, name: mail.toName } : { email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        ...(mail.html && { htmlContent: mail.html }),
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Brevo respondió ${res.status}${detail ? `: ${detail}` : ''}`);
    }
  }

  private render(vars: Record<string, string>): string {
    this.template ??= readFileSync(join(process.cwd(), 'templates', 'correo-codigo-recuperacion.html'), 'utf8');
    return Object.entries(vars).reduce((html, [k, v]) => html.replaceAll(`{{${k}}}`, v), this.template);
  }
}
