import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client';
import { derivePaymentStatus } from './payment-status';
import { resolveTerms } from './sale-terms';

const soldAt = new Date('2026-03-01T12:00:00Z');
const fieldOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as BadRequestException).getResponse
      ? ((e as BadRequestException).getResponse() as { errors: { field: string }[] }).errors[0].field
      : undefined;
  }
  return undefined;
};

describe('derivePaymentStatus', () => {
  it('PAID / PARTIAL / PENDING según el saldo', () => {
    expect(derivePaymentStatus(100, 0)).toBe(PaymentStatus.PAID);
    expect(derivePaymentStatus(100, 40)).toBe(PaymentStatus.PARTIAL);
    expect(derivePaymentStatus(100, 100)).toBe(PaymentStatus.PENDING);
    expect(derivePaymentStatus('100.00', '0.01')).toBe(PaymentStatus.PARTIAL);
  });
});

describe('resolveTerms', () => {
  it('contado: cobra todo en el acto', () => {
    const r = resolveTerms('230.00', { paymentMethod: PaymentMethod.CASH }, 15, soldAt);
    expect(r.paymentStatus).toBe(PaymentStatus.PAID);
    expect(r.balance.toFixed(2)).toBe('0.00');
    expect(r.dueDate).toBeNull();
    expect(r.payment).toMatchObject({ method: PaymentMethod.CASH });
    expect(r.payment?.amount.toFixed(2)).toBe('230.00');
  });

  it('transferencia exige referencia', () => {
    expect(fieldOf(() => resolveTerms(100, { paymentMethod: PaymentMethod.TRANSFER }, 15, soldAt))).toBe('reference');
    const ok = resolveTerms(100, { paymentMethod: PaymentMethod.TRANSFER, reference: 'TX-1' }, 15, soldAt);
    expect(ok.payment?.reference).toBe('TX-1');
  });

  it('contado rechaza campos de crédito', () => {
    expect(fieldOf(() => resolveTerms(100, { paymentMethod: PaymentMethod.CASH, creditDays: 30 }, 15, soldAt))).toBe('creditDays');
    expect(fieldOf(() => resolveTerms(100, { paymentMethod: PaymentMethod.CASH, initialPayment: 10 }, 15, soldAt))).toBe('initialPayment');
  });

  it('crédito sin abono: PENDING, saldo = total, vence a 15 días por defecto', () => {
    const r = resolveTerms(100, { paymentMethod: PaymentMethod.CREDIT }, 15, soldAt);
    expect(r.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(r.balance.toFixed(2)).toBe('100.00');
    expect(r.payment).toBeNull();
    expect(r.dueDate?.toISOString()).toBe('2026-03-16T12:00:00.000Z');
  });

  it('crédito con plazo propio y abono inicial: PARTIAL', () => {
    const r = resolveTerms(
      100,
      { paymentMethod: PaymentMethod.CREDIT, creditDays: 30, initialPayment: 25, initialPaymentMethod: PaymentMethod.CASH },
      15,
      soldAt,
    );
    expect(r.paymentStatus).toBe(PaymentStatus.PARTIAL);
    expect(r.balance.toFixed(2)).toBe('75.00');
    expect(r.dueDate?.toISOString()).toBe('2026-03-31T12:00:00.000Z');
    expect(r.payment?.amount.toFixed(2)).toBe('25.00');
  });

  it('el abono inicial debe ser menor al total y tener medio de pago', () => {
    const credit = { paymentMethod: PaymentMethod.CREDIT };
    expect(fieldOf(() => resolveTerms(100, { ...credit, initialPayment: 100, initialPaymentMethod: PaymentMethod.CASH }, 15, soldAt))).toBe('initialPayment');
    expect(fieldOf(() => resolveTerms(100, { ...credit, initialPayment: 10 }, 15, soldAt))).toBe('initialPaymentMethod');
    expect(fieldOf(() => resolveTerms(100, { ...credit, initialPayment: 10, initialPaymentMethod: PaymentMethod.CREDIT }, 15, soldAt))).toBe('initialPaymentMethod');
    expect(fieldOf(() => resolveTerms(100, { ...credit, initialPaymentMethod: PaymentMethod.CASH }, 15, soldAt))).toBe('initialPaymentMethod');
  });
});