import { addDays, dateRange, parseBoundary } from './dates';

describe('dates', () => {
  it('fecha sin hora → inicio/fin del día en UTC-6', () => {
    expect(parseBoundary('2026-03-15', 'start').toISOString()).toBe('2026-03-15T06:00:00.000Z');
    expect(parseBoundary('2026-03-15', 'end').toISOString()).toBe('2026-03-16T05:59:59.999Z');
  });

  it('un ISO completo se respeta', () => {
    expect(parseBoundary('2026-03-15T10:00:00Z', 'end').toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });

  it('dateRange vacío → undefined; parcial → solo el lado dado', () => {
    expect(dateRange()).toBeUndefined();
    expect(dateRange('2026-01-01')).toEqual({ gte: new Date('2026-01-01T06:00:00.000Z') });
    expect(dateRange(undefined, '2026-01-01')?.gte).toBeUndefined();
  });

  it('addDays', () => {
    expect(addDays(new Date('2026-01-30T00:00:00Z'), 3).toISOString()).toBe('2026-02-02T00:00:00.000Z');
  });
});
