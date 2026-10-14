import { ServiceOrderStatus } from '../generated/prisma/client';

/**
 * Flujo de una orden de servicio (OPI):
 *   REGISTRADA → ASIGNADA → EN PROCESO → COMPLETADA → FACTURADA
 * Puede CANCELARSE desde cualquier estado que no sea final. FACTURADA y CANCELADA son finales.
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
