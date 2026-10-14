import { BadRequestException } from '@nestjs/common';
import { addDays, parseBoundary } from '../common/utils/dates';

export const DEFAULT_VALIDITY_DAYS = 15;
export const MAX_VALIDITY_DAYS = 365;

/**
 * Fecha de validez de una cotización. Sin dato → hoy + 15 días. Una fecha sin hora
 * ("2026-03-15") vale hasta el final de ese día en hora de Nicaragua.
 */
export function resolveValidUntil(input: string | undefined, now: Date = new Date()): Date {
  if (!input) return addDays(now, DEFAULT_VALIDITY_DAYS);
  const date = parseBoundary(input, 'end');
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
    throw new BadRequestException({
      message: 'Fecha de validez inválida',
      errors: [{ field: 'validUntil', message: 'La fecha de validez debe ser futura' }],
    });
  }
  if (date.getTime() > addDays(now, MAX_VALIDITY_DAYS).getTime()) {
    throw new BadRequestException({
      message: 'Fecha de validez inválida',
      errors: [{ field: 'validUntil', message: `La validez no puede superar ${MAX_VALIDITY_DAYS} días` }],
    });
  }
  return date;
}
