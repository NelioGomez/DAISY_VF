import { ServiceOrderStatus } from '../generated/prisma/client';

/**
 * Flujo de una orden de servicio (OPI):
 *   REGISTRADA → ASIGNADA → EN PROCESO → COMPLETADA → FACTURADA
 * Puede CANCELARSE desde cualquier estado que no sea final. FACTURADA y CANCELADA son finales.
 * Una orden EN GARANTÍA no se cobra: termina en COMPLETADA (mejora n.° 60).
 */
export const SERVICE_ORDER_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  REGISTERED: [ServiceOrderStatus.ASSIGNED, ServiceOrderStatus.CANCELLED],
  ASSIGNED: [ServiceOrderStatus.IN_PROGRESS, ServiceOrderStatus.CANCELLED],
  IN_PROGRESS: [ServiceOrderStatus.COMPLETED, ServiceOrderStatus.CANCELLED],
  COMPLETED: [ServiceOrderStatus.INVOICED, ServiceOrderStatus.CANCELLED],
  INVOICED: [],
  CANCELLED: [],
};

export const canAdvance = (from: ServiceOrderStatus, to: ServiceOrderStatus): boolean =>
  SERVICE_ORDER_TRANSITIONS[from].includes(to);

export const isFinal = (s: ServiceOrderStatus): boolean => SERVICE_ORDER_TRANSITIONS[s].length === 0;

/** Ya no admite cambios: final, o completada en garantía (no se factura). */
export const isClosed = (s: ServiceOrderStatus, underWarranty: boolean): boolean =>
  isFinal(s) || (underWarranty && s === ServiceOrderStatus.COMPLETED);

/** Garantía del trabajo realizado si al completar no se indica otra (días). */
export const DEFAULT_SERVICE_WARRANTY_DAYS = 90;
