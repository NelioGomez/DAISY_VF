/**
 * Reglas puras de manufactura (sin base de datos), para poder probarlas aisladas.
 */
import { LotStatus, NonconformityDisposition, ProductionOrderStatus } from '../generated/prisma/client';

/** Transiciones permitidas de una orden de producción. */
const FLOW: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  DRAFT: [ProductionOrderStatus.RELEASED, ProductionOrderStatus.CANCELLED],
  RELEASED: [ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.CANCELLED],
  IN_PROGRESS: [ProductionOrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export const canMoveOrder = (from: ProductionOrderStatus, to: ProductionOrderStatus) => FLOW[from].includes(to);

/** Requerimiento de materiales: cantidad por unidad × unidades a fabricar. */
export function materialPlan(items: { componentId: string; quantity: number }[], orderQuantity: number) {
  return items.map((i) => ({ componentId: i.componentId, plannedQuantity: i.quantity * orderQuantity }));
}

export interface LotQuantities {
  quantity: number;
  pendingQuantity: number;
  reworkQuantity: number;
  releasedQuantity: number;
  scrappedQuantity: number;
}

/** Estado del lote según sus cantidades. */
export function lotStatus(l: LotQuantities): LotStatus {
  if (l.reworkQuantity > 0) return LotStatus.REWORK;
  if (l.pendingQuantity > 0) return LotStatus.PENDING_QC;
  if (l.releasedQuantity > 0) return LotStatus.RELEASED;
  return LotStatus.SCRAPPED;
}

export interface InspectionOutcome {
  stage: 'INITIAL' | 'REWORK';
  inspected: number;
  /** Unidades que entran al inventario (conformes + no conformes liberadas por concesión). */
  toStock: number;
  lot: LotQuantities;
}

/**
 * Efecto de una inspección: primero se inspeccionan las unidades pendientes; si no hay, las
 * que volvieron de retrabajo. Las conformes se liberan; las no conformes siguen su disposición:
 * SCRAP (se desechan), REWORK (vuelven a inspección después del retrabajo) o RELEASE (concesión).
 */
export function applyInspection(lot: LotQuantities, defective: number, disposition?: NonconformityDisposition | null): InspectionOutcome {
  const stage = lot.pendingQuantity > 0 ? 'INITIAL' : 'REWORK';
  const inspected = stage === 'INITIAL' ? lot.pendingQuantity : lot.reworkQuantity;
  if (inspected <= 0) throw new Error('El lote no tiene unidades por inspeccionar');
  if (!Number.isInteger(defective) || defective < 0 || defective > inspected) throw new Error(`Las no conformes deben estar entre 0 y ${inspected}`);
  if (defective > 0 && !disposition) throw new Error('Indique la disposición de las unidades no conformes');

  const next: LotQuantities = { ...lot };
  if (stage === 'INITIAL') next.pendingQuantity = 0;
  else next.reworkQuantity = 0;

  const conforming = inspected - defective;
  let toStock = conforming;
  next.releasedQuantity += conforming;
  if (defective > 0) {
    if (disposition === NonconformityDisposition.SCRAP) next.scrappedQuantity += defective;
    else if (disposition === NonconformityDisposition.REWORK) next.reworkQuantity += defective;
    else {
      next.releasedQuantity += defective;
      toStock += defective;
    }
  }
  return { stage, inspected, toStock, lot: next };
}

/** Costo unitario del producto terminado: materiales consumidos ÷ unidades producidas. */
export function unitCostOf(materialCost: number, produced: number): number {
  return produced > 0 ? Math.round((materialCost / produced) * 10_000) / 10_000 : 0;
}
