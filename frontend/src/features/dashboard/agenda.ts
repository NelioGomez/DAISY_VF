/* Pendientes accionables del día (mejoras n.° 1 y 40). El servidor envía solo los que el
   rol puede ver; aquí se decide el texto del botón y a qué pantalla lleva cada uno. */
import type { DashboardResumen } from '../../types';

export interface AgendaItem {
  tipo: string;
  severidad: 'critical' | 'warning' | 'info';
  mensaje: string;
  cantidad: number;
  ic: string;
  link: string;
  accion: string;
}

const ORDER = { critical: 0, warning: 1, info: 2 } as const;

const SPEC: Record<string, { ic: string; link: string | ((can: (p: string) => boolean) => string); accion: string }> = {
  OUT_OF_STOCK: { ic: '✕', link: (can) => (can('purchases:read') ? '/app/compras?tab=reabastecimiento' : '/app/inventario'), accion: 'Reabastecer' },
  LOW_STOCK: { ic: '▼', link: (can) => (can('purchases:read') ? '/app/compras?tab=reabastecimiento' : '/app/inventario'), accion: 'Reabastecer' },
  OVERDUE_RECEIVABLES: { ic: '◷', link: '/app/pagos', accion: 'Cobrar' },
  RECEIVABLES_DUE_SOON: { ic: '◔', link: '/app/pagos', accion: 'Ver cuentas' },
  QUOTATIONS_EXPIRING: { ic: '⌛', link: '/app/cotizaciones', accion: 'Dar seguimiento' },
  QUOTATIONS_APPROVED: { ic: '✓', link: '/app/cotizaciones', accion: 'Convertir en venta' },
  NEW_INQUIRIES: { ic: '✉', link: '/app/consultas', accion: 'Atender' },
  PURCHASES_LATE: { ic: '!', link: '/app/compras', accion: 'Revisar compras' },
  PURCHASES_TO_RECEIVE: { ic: '▣', link: '/app/compras', accion: 'Registrar recepción' },
  SERVICE_ORDERS_UNASSIGNED: { ic: '▩', link: '/app/ordenes', accion: 'Asignar técnico' },
  SERVICE_ORDERS_ASSIGNED: { ic: '▩', link: '/app/ordenes', accion: 'Ver mis órdenes' },
  LOTS_PENDING_QC: { ic: '▦', link: '/app/produccion?tab=lotes', accion: 'Inspeccionar' },
  PRODUCTION_RELEASED: { ic: '⚙', link: '/app/produccion', accion: 'Iniciar producción' },
};

/** Pendientes ordenados por urgencia: críticos, luego advertencias y al final informativos. */
export function agenda(d: DashboardResumen | null, can: (p: string) => boolean): AgendaItem[] {
  if (!d) return [];
  return d.alertas
    .map((a) => {
      const spec = SPEC[a.tipo] ?? { ic: '•', link: '/app/dashboard', accion: 'Ver' };
      const severidad = (a.severidad in ORDER ? a.severidad : 'info') as AgendaItem['severidad'];
      return {
        tipo: a.tipo,
        severidad,
        mensaje: a.mensaje,
        cantidad: a.cantidad,
        ic: spec.ic,
        link: typeof spec.link === 'function' ? spec.link(can) : spec.link,
        accion: spec.accion,
      };
    })
    .sort((x, y) => ORDER[x.severidad] - ORDER[y.severidad]);
}

/** Variación porcentual contra el período anterior (null si no hay base para comparar). */
export function variacion(actual: number, previo: number): number | null {
  if (!previo) return null;
  return Math.round(((actual - previo) / previo) * 100);
}
