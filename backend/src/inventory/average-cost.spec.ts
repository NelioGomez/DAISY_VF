import { weightedAverageCost } from './average-cost';

describe('weightedAverageCost', () => {
  it('sin existencias, el costo promedio es el de la entrada', () => {
    expect(weightedAverageCost(0, 0, 10, 25.5).toFixed(4)).toBe('25.5000');
  });

  it('promedia ponderando por cantidad', () => {
    // 10 u. a 100 + 10 u. a 200 → 150
    expect(weightedAverageCost(10, 100, 10, 200).toFixed(4)).toBe('150.0000');
    // 30 u. a 10 + 10 u. a 14 → 11
    expect(weightedAverageCost(30, 10, 10, 14).toFixed(4)).toBe('11.0000');
  });

  it('redondea a 4 decimales sin errores de coma flotante', () => {
    // (3 × 0.1 + 1 × 0.2) / 4 = 0.125
    expect(weightedAverageCost(3, 0.1, 1, 0.2).toFixed(4)).toBe('0.1250');
    expect(weightedAverageCost(1, 10, 2, 10.01).toFixed(4)).toBe('10.0067');
  });

  it('una entrada de costo 0 diluye el promedio', () => {
    expect(weightedAverageCost(10, 50, 10, 0).toFixed(4)).toBe('25.0000');
  });
});
