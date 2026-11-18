/* Textos de la bitácora para el panel de administración (mejoras n.° 69 y 71). */
import type { TagTone } from '../../components/tables/Tag';
import type { Evento } from './adminApi';

/** Acción → texto y color. Lo que no esté aquí se muestra tal cual. */
export const ACCIONES: Record<string, [string, TagTone]> = {
  LOGIN: ['Inicio de sesión', 't-green'],
  LOGIN_FAILED: ['Intento fallido', 't-red'],
  LOGIN_BLOCKED: ['Usuario inactivo', 't-amber'],
  LOGOUT: ['Cierre de sesión', 't-gray'],
  PASSWORD_RESET_REQUEST: ['Pidió recuperar contraseña', 't-blue'],
  PASSWORD_RESET: ['Recuperó su contraseña', 't-blue'],
  CHANGE_PASSWORD: ['Cambió su contraseña', 't-blue'],
  CHANGE_EMAIL: ['Cambió su correo', 't-blue'],
  CREATE: ['Creado', 't-green'],
  UPDATE: ['Modificado', 't-blue'],
  DELETE: ['Eliminado', 't-red'],
  ACTIVATE: ['Activado', 't-green'],
  DEACTIVATE: ['Desactivado', 't-amber'],
  RESET_PASSWORD: ['Contraseña restablecida', 't-violet'],
  REVOKE_SESSIONS: ['Sesiones cerradas', 't-violet'],
  VOID: ['Anulado', 't-red'],
  EXPORT: ['Exportó', 't-gray'],
};

export const MODULOS: Record<string, string> = {
  auth: 'SIVEN',
  portal: 'Portal',
  users: 'Usuarios',
  'customer-accounts': 'Cuentas del portal',
  settings: 'Empresa',
  categories: 'Categorías',
  brands: 'Marcas',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  products: 'Productos',
  inventory: 'Inventario',
  purchases: 'Compras',
  production: 'Producción',
  sales: 'Ventas',
  payments: 'Pagos',
  quotations: 'Cotizaciones',
  'service-orders': 'Órdenes de servicio',
  inquiries: 'Consultas web',
  reports: 'Reportes',
  audit: 'Auditoría',
};

export const accion = (a: string): [string, TagTone] => ACCIONES[a] ?? [a, 't-gray'];

/** Quién hizo la acción. En el portal el correo viene en la descripción: «… (correo)». */
export const quien = (e: Evento): string => e.username || /\(([^()\s]+@[^()\s]+)\)\s*$/.exec(e.description ?? '')?.[1] || '—';

/** Fecha de hace `dias` días en formato AAAA-MM-DD (hora de Nicaragua). */
export function haceDias(dias: number): string {
  const d = new Date(Date.now() - dias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua' }).format(d);
}
