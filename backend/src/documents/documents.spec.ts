import { formatDocumentNumber } from './document-sequence.service';
import { calculateTotals } from './tax.service';

describe('calculateTotals (IVA exclusivo)', () => {
  it('suma líneas, aplica 15% y redondea a 2 decimales', () => {
    const t = calculateTotals(['100.00', '50.50'], '0.15');
    expect(t.subtotal.toFixed(2)).toBe('150.50');
    expect(t.tax.toFixed(2)).toBe('22.58'); // 22.575 → 22.58 (mitad hacia arriba)
    expect(t.total.toFixed(2)).toBe('173.08');
  });

  it('evita el error de coma flotante clásico (0.1 + 0.2)', () => {
    const t = calculateTotals(['0.10', '0.20'], '0.15');
    expect(t.subtotal.toFixed(2)).toBe('0.30');
    expect(t.tax.toFixed(2)).toBe('0.05');
    expect(t.total.toFixed(2)).toBe('0.35');
  });

  it('sin líneas o con tasa 0 → ceros / sin impuesto', () => {
    expect(calculateTotals([], '0.15').total.toFixed(2)).toBe('0.00');
    expect(calculateTotals(['10.00'], 0).tax.toFixed(2)).toBe('0.00');
  });
});

describe('formatDocumentNumber', () => {
  it('rellena con ceros a 6 dígitos', () => {
    expect(formatDocumentNumber('FAC', 1)).toBe('FAC-000001');
    expect(formatDocumentNumber('COT', 123456)).toBe('COT-123456');
    expect(formatDocumentNumber('OPI', 1234567)).toBe('OPI-1234567');
  });
});