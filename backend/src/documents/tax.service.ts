import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal, money } from '../common/utils/money';

export interface Totals {
  subtotal: Decimal;
  tax: Decimal;
  total: Decimal;
}

/** Calcula el IVA (exclusivo: se suma al subtotal). La tasa vive en system_config (TAX_RATE). */
export function calculateTotals(lineSubtotals: Decimal.Value[], rate: Decimal.Value): Totals {
  const subtotal = money(lineSubtotals.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)));
  const tax = money(subtotal.times(rate));
  return { subtotal, tax, total: subtotal.plus(tax) };
}

@Injectable()
export class TaxService {
  private static readonly DEFAULT_RATE = '0.15';

  constructor(private readonly prisma: PrismaService) {}

  async getRate(db: Prisma.TransactionClient = this.prisma): Promise<Decimal> {
    const row = await db.systemConfig.findUnique({ where: { key: 'TAX_RATE' } });
    const parsed = row ? new Decimal(row.value) : new Decimal(TaxService.DEFAULT_RATE);
    if (!parsed.isFinite() || parsed.isNegative() || parsed.greaterThan(1)) {
      return new Decimal(TaxService.DEFAULT_RATE);
    }
    return parsed;
  }

  /** Plazo de crédito por defecto en días (CREDIT_TERM_DAYS, 15 si no existe). */
  async getCreditDays(db: Prisma.TransactionClient = this.prisma): Promise<number> {
    const row = await db.systemConfig.findUnique({ where: { key: 'CREDIT_TERM_DAYS' } });
    const n = row ? Number.parseInt(row.value, 10) : NaN;
    return Number.isInteger(n) && n > 0 && n <= 365 ? n : 15;
  }
}