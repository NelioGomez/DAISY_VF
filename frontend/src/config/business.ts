/* =====================================================================
   Reglas de negocio configurables del frontend.
   Se centralizan aquí para que cambiarlas no obligue a tocar componentes.
   ===================================================================== */
import type { EstadoOrden } from '../types';

// El impuesto ya no vive aquí: lo define el servidor (system_config → GET /settings).
// NORCOR está en régimen de cuota fija, así que por defecto no se cobra IVA.

export const VALIDEZ_COTIZACION = '15 días';
export const DIAS_CREDITO = 15;

export const CATEGORIAS = [
  'Dispensadores',
  'Filtros',
  'Mangueras',
  'Boquillas',
  'Eléctrico',
  'Conectores',
  'Bombas',
  'Sellos',
] as const;

/** Flujo de estados de las órdenes de servicio (OPI). */
export const OPI_FLOW: EstadoOrden[] = ['Registrada', 'Asignada', 'En proceso', 'Completada', 'Facturada'];

/** WhatsApp de respaldo del sitio público. El número real se configura en el servidor
    (system_config → COMPANY_WHATSAPP) y tiene prioridad sobre este. */
export const WHATSAPP_NUMBER = '50588001100';
