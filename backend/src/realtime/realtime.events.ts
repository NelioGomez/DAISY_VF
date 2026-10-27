/**
 * Qué usuarios deben enterarse de cada cambio.
 *
 * - `primary`: permisos de lectura del módulo que cambió. Reciben el evento completo
 *   (quién lo hizo y la descripción de la auditoría).
 * - `related`: permisos de otros módulos cuyos datos también cambian (una venta mueve
 *   stock, cuentas por cobrar y el dashboard). Reciben solo { module, action, at }, para
 *   que refresquen su vista sin ver detalles de un módulo al que no tienen acceso.
 *
 * Los módulos que no aparecen aquí (auth, audit, reports) no cambian datos de negocio
 * y no se transmiten; solo quedan en la bitácora y en la terminal.
 */
export const CHANGE_AUDIENCE: Record<string, { primary: string[]; related: string[] }> = {
  products: { primary: ['products:read'], related: ['inventory:read', 'catalog:read', 'dashboard:read'] },
  categories: { primary: ['categories:read'], related: ['products:read', 'inventory:read', 'catalog:read'] },
  brands: { primary: ['brands:read'], related: ['products:read', 'inventory:read', 'catalog:read'] },
  inventory: { primary: ['inventory:read'], related: ['products:read', 'catalog:read', 'dashboard:read'] },
  customers: { primary: ['customers:read'], related: ['sales:read', 'quotations:read', 'service-orders:read'] },
  suppliers: { primary: ['suppliers:read'], related: ['inventory:read'] },
  quotations: { primary: ['quotations:read'], related: ['dashboard:read'] },
  sales: {
    primary: ['sales:read'],
    related: ['inventory:read', 'products:read', 'payments:read', 'customers:read', 'quotations:read', 'service-orders:read', 'dashboard:read', 'catalog:read'],
  },
  payments: { primary: ['payments:read'], related: ['sales:read', 'customers:read', 'dashboard:read'] },
  'service-orders': { primary: ['service-orders:read'], related: ['dashboard:read'] },
  inquiries: { primary: ['inquiries:read'], related: ['dashboard:read'] },
  users: { primary: ['users:read'], related: [] },
  // Impuesto o datos de la empresa: todos recargan la configuración (sin detalle).
  settings: { primary: ['settings:read'], related: ['dashboard:read'] },
  roles: { primary: ['users:read'], related: [] },
};

/** Evento que recibe el cliente en el canal `change`. */
export interface ChangeEvent {
  module: string;
  action: string;
  at: string;
  /** Solo para quienes leen el módulo que cambió. */
  entity?: string | null;
  entityId?: string | null;
  description?: string | null;
  username?: string | null;
  userId?: string | null;
}

export const permissionRoom = (code: string) => `perm:${code}`;
export const userRoom = (id: string) => `user:${id}`;
