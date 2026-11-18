import { daysOfCover, rotationOf } from './rotation';

describe('Rotación de inventario', () => {
  it('días de inventario al ritmo de los últimos 90 días', () => {
    expect(daysOfCover(30, 90)).toBe(30); // vende 1 por día
    expect(daysOfCover(10, 45)).toBe(20); // 0.5 por día
    expect(daysOfCover(5, 0)).toBeNull(); // sin ventas
  });

  it('clasifica en alta, media, baja o sin movimiento', () => {
    expect(rotationOf(30, 90)).toBe('ALTA');
    expect(rotationOf(0, 12)).toBe('ALTA'); // agotado y con ventas
    expect(rotationOf(60, 90)).toBe('MEDIA');
    expect(rotationOf(91, 90)).toBe('BAJA');
    expect(rotationOf(8, 0)).toBe('SIN_MOVIMIENTO');
  });
});
