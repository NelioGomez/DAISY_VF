/* =====================================================================
   Roles, permisos visuales y menú (RNF-04 / RF-02).
   IMPORTANTE: ocultar módulos aquí solo mejora la experiencia; la
   autorización real debe aplicarse en NestJS con guards por rol.
   ===================================================================== */
import type { ModuleId, RoleInfo, RoleKey } from '../types';

export const ROLES: Record<RoleKey, RoleInfo> = {
  admin: { name: 'Administrador', user: 'admin', desc: 'Acceso total', color: '#6b54c4' },
  gerencia: { name: 'Gerencia', user: 'gerencia', desc: 'Dashboard y reportes', color: '#2f6fb0' },
  vendedor: { name: 'Vendedor', user: 'jflores', desc: 'Ventas y clientes', color: '#1f9d5a' },
  inventario: { name: 'Enc. Inventario', user: 'ngomez', desc: 'Productos e inventario', color: '#c97f00' },
  contabilidad: { name: 'Contabilidad', user: 'eurcuyo', desc: 'Pagos y facturación', color: '#b32a20' },
  tecnico: { name: 'Técnico / OPI', user: 'tecnico', desc: 'Órdenes de servicio', color: '#205283' },
};

/** Módulos visibles por rol. El primero es la vista inicial al iniciar sesión. */
export const ACCESS: Record<RoleKey, ModuleId[]> = {
  admin: ['dashboard', 'productos', 'inventario', 'compras', 'produccion', 'clientes', 'proveedores', 'cotizaciones', 'ventas', 'pagos', 'ordenes', 'reportes', 'catalogo', 'consultas', 'auditoria'],
  gerencia: ['dashboard', 'reportes', 'inventario', 'compras', 'produccion', 'ventas', 'auditoria'],
  vendedor: ['dashboard', 'clientes', 'cotizaciones', 'ventas', 'catalogo', 'consultas'],
  inventario: ['dashboard', 'productos', 'inventario', 'compras', 'produccion', 'proveedores'],
  contabilidad: ['dashboard', 'ventas', 'pagos', 'compras', 'reportes'],
  tecnico: ['dashboard', 'ordenes'],
};

export interface MenuItem {
  id: ModuleId;
  t: string;
  ic: string;
  /** Ruta propia dentro del módulo (p. ej. el punto de venta dentro de Ventas). */
  to?: string;
  /** Permiso adicional para mostrar la entrada. */
  perm?: string;
  /** Activo solo con la ruta exacta (para no marcarse junto a sus subpantallas). */
  end?: boolean;
}

export interface MenuGroup {
  grp: string;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    grp: 'Operación',
    items: [
      { id: 'dashboard', t: 'Dashboard', ic: '▦' },
      { id: 'ventas', t: 'Punto de venta', ic: '⊞', to: '/app/ventas/nueva', perm: 'sales:write' },
      { id: 'productos', t: 'Productos', ic: '▣' },
      { id: 'inventario', t: 'Inventario', ic: '▤' },
      { id: 'compras', t: 'Compras', ic: '⇩' },
      { id: 'produccion', t: 'Producción', ic: '⚙' },
      { id: 'cotizaciones', t: 'Cotizaciones', ic: '▥' },
      { id: 'ventas', t: 'Ventas y Facturación', ic: '▧', end: true },
      { id: 'pagos', t: 'Pagos y CxC', ic: '▨' },
      { id: 'ordenes', t: 'Órdenes OPI', ic: '▩' },
    ],
  },
  {
    grp: 'Catálogos',
    items: [
      { id: 'clientes', t: 'Clientes', ic: '◧' },
      { id: 'proveedores', t: 'Proveedores', ic: '◨' },
      { id: 'consultas', t: 'Consultas web', ic: '◫' },
    ],
  },
  {
    grp: 'Análisis y Control',
    items: [
      { id: 'reportes', t: 'Reportes y KPIs', ic: '◩' },
      { id: 'catalogo', t: 'Catálogo web', ic: '◪' },
      { id: 'auditoria', t: 'Auditoría', ic: '◎' },
    ],
  },
];

export const TITLES: Record<ModuleId, [string, string]> = {
  dashboard: ['Dashboard', 'Panel de control gerencial'],
  productos: ['Productos', 'Catálogo interno de repuestos'],
  inventario: ['Inventario', 'Movimientos y control de existencias'],
  compras: ['Compras', 'Órdenes de compra, recepción y reabastecimiento'],
  produccion: ['Producción', 'BOM, órdenes de producción, lotes y control de calidad'],
  clientes: ['Clientes', 'Cartera de clientes'],
  proveedores: ['Proveedores', 'Proveedores nacionales e internacionales'],
  cotizaciones: ['Cotizaciones', 'Proformas y conversión a venta'],
  ventas: ['Ventas y Facturación', 'Registro de ventas y facturas'],
  pagos: ['Pagos y Cuentas por Cobrar', 'Control de pagos y saldos'],
  ordenes: ['Órdenes de Servicio (OPI)', 'Seguimiento técnico'],
  reportes: ['Reportes y KPIs', 'Indicadores y exportación'],
  catalogo: ['Catálogo Web', 'Vista pública de productos'],
  auditoria: ['Auditoría', 'Bitácora de acciones del sistema'],
  consultas: ['Consultas Web', 'Solicitudes de clientes desde el sitio'],
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
export const MODULE_COUNT = MENU.reduce((n, g) => n + g.items.length, 0);

export const isModuleId = (v: string | undefined): v is ModuleId => !!v && v in TITLES;

/** Permiso del backend necesario para ver cada módulo. */
export const MODULE_PERMISSION: Record<ModuleId, string> = {
  dashboard: 'dashboard:read',
  productos: 'products:read',
  inventario: 'inventory:read',
  compras: 'purchases:read',
  produccion: 'production:read',
  clientes: 'customers:read',
  proveedores: 'suppliers:read',
  cotizaciones: 'quotations:read',
  ventas: 'sales:read',
  pagos: 'payments:read',
  ordenes: 'service-orders:read',
  reportes: 'reports:read',
  catalogo: 'catalog:read',
  consultas: 'inquiries:read',
  auditoria: 'audit:read',
};

/**
 * Módulos que ve un usuario: el menú diseñado para su rol, limitado a lo que
 * sus permisos reales (enviados por el servidor) le permiten abrir.
 */
export function visibleModules(user: { role: RoleKey; permissions: string[] }): ModuleId[] {
  return ACCESS[user.role].filter((m) => user.permissions.includes(MODULE_PERMISSION[m]));
}
