/* =====================================================================
   Reglas de negocio configurables del frontend.
   Se centralizan aquí para que cambiarlas no obligue a tocar componentes.
   ===================================================================== */
import type { EstadoOrden } from '../types';

/**
 * Tasa de IVA aplicada a cotizaciones y facturas (comportamiento del prototipo).
 * PENDIENTE (P0 del análisis UX): con el escenario de cuota fija debe retirarse
 * del frontend y venir de configuración del backend.
 */
export const IVA = 0.15;

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

export const WHATSAPP_URL = 'https://wa.me/50588001100?text=Hola%20NORCOR,%20necesito%20cotizaci%C3%B3n';
