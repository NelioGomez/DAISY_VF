import { ServiceOrderStatus as S } from '../generated/prisma/client';
import { canAdvance, isFinal } from './service-order-status';

describe('service order status machine', () => {
  it('flujo completo hasta facturar', () => {
    const path = [S.REGISTERED, S.ASSIGNED, S.IN_PROGRESS, S.COMPLETED, S.INVOICED];
    for (let i = 0; i < path.length - 1; i++) expect(canAdvance(path[i], path[i + 1])).toBe(true);
  });

  it('no se puede saltar etapas ni retroceder', () => {
    expect(canAdvance(S.REGISTERED, S.IN_PROGRESS)).toBe(false);
    expect(canAdvance(S.ASSIGNED, S.COMPLETED)).toBe(false);
    expect(canAdvance(S.COMPLETED, S.IN_PROGRESS)).toBe(false);
    expect(canAdvance(S.IN_PROGRESS, S.INVOICED)).toBe(false);
  });

  it('se cancela desde cualquier estado no final', () => {
    for (const s of [S.REGISTERED, S.ASSIGNED, S.IN_PROGRESS, S.COMPLETED]) {
      expect(canAdvance(s, S.CANCELLED)).toBe(true);
    }
  });

  it('FACTURADA y CANCELADA son finales', () => {
    expect(isFinal(S.INVOICED)).toBe(true);
    expect(isFinal(S.CANCELLED)).toBe(true);
    expect(isFinal(S.COMPLETED)).toBe(false);
    expect(canAdvance(S.INVOICED, S.CANCELLED)).toBe(false);
  });
});
