import { BadRequestException } from '@nestjs/common';
import { QuotationStatus as S } from '../generated/prisma/client';
import { canTransition, isEditable } from './quotation-status';
import { resolveValidUntil } from './validity';

describe('quotation status machine', () => {
  it('flujo feliz', () => {
    expect(canTransition(S.DRAFT, S.PENDING)).toBe(true);
    expect(canTransition(S.PENDING, S.APPROVED)).toBe(true);
    expect(canTransition(S.APPROVED, S.CONVERTED)).toBe(true);
  });

  it('no se puede convertir sin aprobar ni saltar etapas', () => {
    expect(canTransition(S.PENDING, S.CONVERTED)).toBe(false);
    expect(canTransition(S.DRAFT, S.APPROVED)).toBe(false);
    expect(canTransition(S.DRAFT, S.REJECTED)).toBe(false);
  });

  it('estados finales no avanzan', () => {
    for (const final of [S.CONVERTED, S.REJECTED, S.EXPIRED]) {
      for (const to of Object.values(S)) expect(canTransition(final, to)).toBe(false);
    }
  });

  it('solo BORRADOR y PENDIENTE son editables', () => {
    expect(isEditable(S.DRAFT)).toBe(true);
    expect(isEditable(S.PENDING)).toBe(true);
    expect(isEditable(S.APPROVED)).toBe(false);
    expect(isEditable(S.CONVERTED)).toBe(false);
  });
});

describe('resolveValidUntil', () => {
  const now = new Date('2026-03-01T12:00:00Z');

  it('por defecto 15 días', () => {
    expect(resolveValidUntil(undefined, now).toISOString()).toBe('2026-03-16T12:00:00.000Z');
  });

  it('una fecha sin hora vale hasta el final del día en Nicaragua (UTC-6)', () => {
    expect(resolveValidUntil('2026-03-20', now).toISOString()).toBe('2026-03-21T05:59:59.999Z');
  });

  it('rechaza fechas pasadas o a más de 365 días', () => {
    expect(() => resolveValidUntil('2026-02-01', now)).toThrow(BadRequestException);
    expect(() => resolveValidUntil('2028-01-01', now)).toThrow(BadRequestException);
    expect(() => resolveValidUntil('2027-02-20', now)).not.toThrow();
  });
});
