import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client';
import { addDays } from '../common/utils/dates';
import { Decimal, money } from '../common/utils/money';
import { derivePaymentStatus } from './payment-status';

export interface SaleTermsInput {
  paymentMethod: PaymentMethod;
  creditDays?: number;
  initialPayment?: number;
  initialPaymentMethod?: PaymentMethod;
  reference?: string;
}

export interface ResolvedTerms {
  paymentStatus: PaymentStatus;
  balance: Decimal;
  dueDate: Date | null;
  /** Pago a registrar junto con la venta (contado/transferencia o abono inicial de crédito). */
  payment: { amount: Decimal; method: PaymentMethod; reference: string | null } | null;
}

const bad = (field: string, message: string) =>
  new BadRequestException({ message: 'Condiciones de pago inválidas', errors: [{ field, message }] });

/**
 * CASH / TRANSFER → se cobra el total en el acto (PAID, saldo 0).
 * CREDIT → saldo = total − abono inicial; vence a los N días (PENDING o PARTIAL).
 */
export function resolveTerms(
  total: Decimal.Value,
  t: SaleTermsInput,
  defaultCreditDays: number,
  soldAt: Date,
): ResolvedTerms {
  const totalD = money(total);

  if (t.paymentMethod !== PaymentMethod.CREDIT) {
    if (t.creditDays !== undefined) throw bad('creditDays', 'Los días de crédito solo aplican a ventas a crédito');
    if (t.initialPayment !== undefined) throw bad('initialPayment', 'El abono inicial solo aplica a ventas a crédito');
    if (t.initialPaymentMethod !== undefined) throw bad('initialPaymentMethod', 'Solo aplica a ventas a crédito');
    if (t.paymentMethod === PaymentMethod.TRANSFER && !t.reference) {
      throw bad('reference', 'Indique la referencia de la transferencia');
    }
    return {
      paymentStatus: PaymentStatus.PAID,
      balance: new Decimal(0),
      dueDate: null,
      payment: { amount: totalD, method: t.paymentMethod, reference: t.reference ?? null },
    };
  }

  const initial = money(t.initialPayment ?? 0);
  if (initial.greaterThanOrEqualTo(totalD)) {
    throw bad('initialPayment', 'El abono inicial debe ser menor que el total; para cobrar todo use contado o transferencia');
  }
  if (initial.greaterThan(0)) {
    if (!t.initialPaymentMethod || t.initialPaymentMethod === PaymentMethod.CREDIT) {
      throw bad('initialPaymentMethod', 'Indique cómo se pagó el abono inicial (CASH o TRANSFER)');
    }
    if (t.initialPaymentMethod === PaymentMethod.TRANSFER && !t.reference) {
      throw bad('reference', 'Indique la referencia de la transferencia');
    }
  } else if (t.initialPaymentMethod !== undefined) {
    throw bad('initialPaymentMethod', 'No hay abono inicial');
  }

  const balance = totalD.minus(initial);
  return {
    paymentStatus: derivePaymentStatus(totalD, balance),
    balance,
    dueDate: addDays(soldAt, t.creditDays ?? defaultCreditDays),
    payment: initial.greaterThan(0)
      ? { amount: initial, method: t.initialPaymentMethod as PaymentMethod, reference: t.reference ?? null }
      : null,
  };
}