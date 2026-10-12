import { PaymentStatus } from '../generated/prisma/client';
import { Decimal } from '../common/utils/money';

/** PAID si no queda saldo; PENDING si no se ha abonado nada; PARTIAL en medio. */
export function derivePaymentStatus(total: Decimal.Value, balance: Decimal.Value): PaymentStatus {
  const t = new Decimal(total);
  const b = new Decimal(balance);
  if (b.lessThanOrEqualTo(0)) return PaymentStatus.PAID;
  if (b.greaterThanOrEqualTo(t)) return PaymentStatus.PENDING;
  return PaymentStatus.PARTIAL;
}