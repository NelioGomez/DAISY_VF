import { LotStatus, NonconformityDisposition, ProductionOrderStatus } from '../generated/prisma/client';
import { applyInspection, canMoveOrder, lotStatus, materialPlan, unitCostOf } from './production-rules';

const lot = (q: number) => ({ quantity: q, pendingQuantity: q, reworkQuantity: 0, releasedQuantity: 0, scrappedQuantity: 0 });

describe('Manufactura: reglas', () => {
  it('flujo de la OP: borrador → liberada → en proceso → terminada; cancelar solo antes de iniciar', () => {
    expect(canMoveOrder(ProductionOrderStatus.DRAFT, ProductionOrderStatus.RELEASED)).toBe(true);
    expect(canMoveOrder(ProductionOrderStatus.RELEASED, ProductionOrderStatus.IN_PROGRESS)).toBe(true);
    expect(canMoveOrder(ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.COMPLETED)).toBe(true);
    expect(canMoveOrder(ProductionOrderStatus.DRAFT, ProductionOrderStatus.IN_PROGRESS)).toBe(false);
    expect(canMoveOrder(ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.CANCELLED)).toBe(false);
    expect(canMoveOrder(ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED)).toBe(false);
  });

  it('requerimiento de materiales de OP-0001: 5 mangueras de 10 pies', () => {
    const plan = materialPlan(
      [
        { componentId: 'manguera-pie', quantity: 10 },
        { componentId: 'terminal-macho', quantity: 1 },
        { componentId: 'terminal-hembra', quantity: 1 },
      ],
      5,
    );
    expect(plan).toEqual([
      { componentId: 'manguera-pie', plannedQuantity: 50 },
      { componentId: 'terminal-macho', plannedQuantity: 5 },
      { componentId: 'terminal-hembra', plannedQuantity: 5 },
    ]);
  });

  it('lote conforme: todo entra al inventario', () => {
    const r = applyInspection(lot(5), 0);
    expect(r).toMatchObject({ stage: 'INITIAL', inspected: 5, toStock: 5 });
    expect(lotStatus(r.lot)).toBe(LotStatus.RELEASED);
  });

  it('no conforme con scrap: las buenas entran y las malas se desechan', () => {
    const r = applyInspection(lot(5), 1, NonconformityDisposition.SCRAP);
    expect(r.toStock).toBe(4);
    expect(r.lot).toMatchObject({ releasedQuantity: 4, scrappedQuantity: 1, pendingQuantity: 0 });
    expect(lotStatus(r.lot)).toBe(LotStatus.RELEASED);
  });

  it('retrabajo: quedan esperando reinspección y luego se liberan', () => {
    const first = applyInspection(lot(5), 2, NonconformityDisposition.REWORK);
    expect(first.toStock).toBe(3);
    expect(lotStatus(first.lot)).toBe(LotStatus.REWORK);
    const second = applyInspection(first.lot, 0);
    expect(second).toMatchObject({ stage: 'REWORK', inspected: 2, toStock: 2 });
    expect(second.lot).toMatchObject({ releasedQuantity: 5, reworkQuantity: 0 });
    expect(lotStatus(second.lot)).toBe(LotStatus.RELEASED);
  });

  it('liberación por concesión: las no conformes también entran', () => {
    const r = applyInspection(lot(3), 1, NonconformityDisposition.RELEASE);
    expect(r.toStock).toBe(3);
    expect(r.lot.releasedQuantity).toBe(3);
  });

  it('todo scrap deja el lote desechado', () => {
    const r = applyInspection(lot(2), 2, NonconformityDisposition.SCRAP);
    expect(r.toStock).toBe(0);
    expect(lotStatus(r.lot)).toBe(LotStatus.SCRAPPED);
  });

  it('valida no conformes y disposición', () => {
    expect(() => applyInspection(lot(5), 6, NonconformityDisposition.SCRAP)).toThrow('entre 0 y 5');
    expect(() => applyInspection(lot(5), 1)).toThrow('disposición');
    const done = applyInspection(lot(1), 0).lot;
    expect(() => applyInspection(done, 0)).toThrow('no tiene unidades');
  });

  it('costo unitario del lote: materiales ÷ unidades producidas', () => {
    expect(unitCostOf(1025, 5)).toBe(205);
    expect(unitCostOf(100, 3)).toBe(33.3333);
    expect(unitCostOf(100, 0)).toBe(0);
  });
});
