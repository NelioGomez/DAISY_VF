import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/settings.dto';

/** Claves editables y cómo se validan (todo lo demás de system_config es interno). */
const RULES: Record<string, (v: string) => string | null> = {
  TAX_RATE: (v) => (/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/.test(v) ? null : 'Tasa entre 0 y 1 (ej. 0 o 0.15)'),
  TAX_REGIME: (v) => (['CUOTA_FIJA', 'IVA'].includes(v) ? null : 'Régimen CUOTA_FIJA o IVA'),
  CREDIT_TERM_DAYS: (v) => (/^\d{1,3}$/.test(v) && +v >= 1 && +v <= 365 ? null : 'Días entre 1 y 365'),
  COMPANY_NAME: (v) => (v.trim() ? null : 'El nombre es obligatorio'),
  COMPANY_RUC: (v) => (!v.trim() || /^[A-Za-z0-9][A-Za-z0-9-]{3,29}$/.test(v.trim()) ? null : 'RUC: solo letras, números y guiones'),
  COMPANY_PHONE: () => null,
  COMPANY_EMAIL: (v) => (!v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'Correo inválido'),
  COMPANY_WHATSAPP: () => null,
  COMPANY_ADDRESS: () => null,
  COMPANY_HOURS: () => null,
};
const PUBLIC_KEYS = ['COMPANY_NAME', 'COMPANY_RUC', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'COMPANY_WHATSAPP', 'COMPANY_ADDRESS', 'COMPANY_HOURS'];

/** El RUC se guarda en mayúsculas; lo demás, tal cual (sin espacios a los lados). */
const clean = (key: string, value: unknown) => (key === 'COMPANY_RUC' ? String(value).trim().toUpperCase() : String(value).trim());

const toCamel = (key: string) => key.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Parámetros que necesita la interfaz (tasa de impuesto, crédito, datos de la empresa). */
  async getAll() {
    const rows = await this.prisma.systemConfig.findMany({ where: { key: { in: Object.keys(RULES) } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      taxRate: Number(map.get('TAX_RATE') ?? 0),
      taxRegime: map.get('TAX_REGIME') ?? 'CUOTA_FIJA',
      creditTermDays: Number(map.get('CREDIT_TERM_DAYS') ?? 15),
      company: Object.fromEntries(PUBLIC_KEYS.map((k) => [toCamel(k.replace('COMPANY_', '')), map.get(k) ?? ''])),
    };
  }

  /** Solo los datos de contacto, para el sitio público. */
  async getPublic() {
    return (await this.getAll()).company;
  }

  async update(dto: UpdateSettingsDto, actor: AuthUser, ip?: string) {
    const entries = Object.entries(dto.values ?? {});
    const errors = entries.flatMap(([key, value]) => {
      const rule = RULES[key];
      const msg = rule ? rule(String(value)) : 'Parámetro no editable';
      return msg ? [{ field: key, message: msg }] : [];
    });
    if (!entries.length) errors.push({ field: 'values', message: 'Indique al menos un parámetro' });
    if (errors.length) throw new BadRequestException({ message: 'Configuración inválida', errors });

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.systemConfig.upsert({
          where: { key },
          update: { value: clean(key, value), updatedById: actor.id },
          create: { key, value: clean(key, value), updatedById: actor.id },
        }),
      ),
    );
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'settings',
      action: 'UPDATE',
      entity: 'SystemConfig',
      description: `Configuración actualizada: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`,
      ip,
    });
    return this.getAll();
  }
}
