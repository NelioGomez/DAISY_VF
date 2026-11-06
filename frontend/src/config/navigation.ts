/* =====================================================================
   Roles, permisos visuales y menú (RNF-04 / RF-02).
   IMPORTANTE: ocultar módulos aquí solo mejora la experiencia; la
   autorización real debe aplicarse en NestJS con guards por rol.
   ===================================================================== */
import type { RefreshKey } from '../store/storeContext';
import type { ModuleId, RoleInfo, RoleKey } from '../types';

export const ROLES: Record<RoleKey, RoleInfo> = {
  admin: { name: 'Administrador', color: '#6b54c4' },
  gerencia: { name: 'Gerencia', color: '#2f6fb0' },
  vendedor: { name: 'Vendedor', color: '#1f9d5a' },
  inventario: { name: 'Enc. Inventario', color: '#c97f00' },
  contabilidad: { name: 'Contabilidad', color: '#b32a20' },
  tecnico: { name: 'Técnico / OPI', color: '#205283' },
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

/** Contadores (avisos) que puede mostrar una entrada del menú. */
export type MenuBadge = 'criticos' | 'comprasPorRecibir' | 'cotizacionesPendientes' | 'cxc' | 'consultasNuevas';

export interface MenuItem {
  /** Módulo de la pantalla: define el permiso y la ruta (/app/<id>). */
  id: ModuleId;
  t: string;
  ic: string;
  /** Nombre cuando es la única pantalla visible de su módulo (se muestra como enlace directo). */
  solo?: string;
  /** Ruta propia dentro del módulo (p. ej. el punto de venta dentro de Ventas). */
  to?: string;
  /** Pestaña del módulo (?tab=…) que abre la entrada. */
  tab?: string;
  /** Es la pestaña por defecto: se marca también cuando la dirección no trae ?tab. */
  tabDefault?: boolean;
  /** Permiso adicional para mostrar la entrada. */
  perm?: string;
  /** Activo solo con la ruta exacta (para no marcarse junto a sus subpantallas). */
  end?: boolean;
  /** Aviso que se muestra junto al nombre. */
  badge?: MenuBadge;
}

/** Módulo desplegable del menú: agrupa sus pantallas. */
export interface MenuSection {
  key: string;
  t: string;
  ic: string;
  items: MenuItem[];
}

export type MenuEntry = MenuItem | MenuSection;

export const isSection = (e: MenuEntry): e is MenuSection => 'items' in e;

/**
 * Menú por módulos desplegables (mejora n.° 55), con la distribución acordada en clase:
 * 1. Compras (productos, pedidos, proveedores e inventario) · 2. Ventas (clientes, cotizaciones,
 * ventas y facturación, órdenes de servicio y canal web) · 3. Pagos y CxC · 4. Dashboard (panel,
 * reportes y KPI). Producción y Auditoría van aparte. Si un rol ve una sola pantalla de un módulo,
 * esa pantalla se muestra como enlace directo.
 */
export const MENU: MenuEntry[] = [
  {
    key: 'dashboard',
    t: 'Dashboard',
    ic: '▦',
    items: [
      { id: 'dashboard', t: 'Panel e indicadores', solo: 'Dashboard', ic: '▦' },
      { id: 'reportes', t: 'Reportes y KPIs', ic: '◩' },
    ],
  },
  {
    key: 'compras',
    t: 'Compras',
    ic: '⇩',
    items: [
      { id: 'productos', t: 'Productos', ic: '▣' },
      { id: 'compras', t: 'Pedidos de compra', ic: '⇩', tab: 'ordenes', tabDefault: true, badge: 'comprasPorRecibir' },
      { id: 'compras', t: 'Reabastecimiento', ic: '↻', tab: 'reabastecimiento' },
      { id: 'proveedores', t: 'Proveedores', ic: '◨' },
      { id: 'inventario', t: 'Inventario', ic: '▤', badge: 'criticos' },
    ],
  },
  {
    key: 'ventas',
    t: 'Ventas',
    ic: '▧',
    items: [
      { id: 'clientes', t: 'Clientes', ic: '◧' },
      { id: 'cotizaciones', t: 'Cotizaciones', ic: '▥', badge: 'cotizacionesPendientes' },
      { id: 'ventas', t: 'Punto de venta', ic: '⊞', to: '/app/ventas/nueva', perm: 'sales:write' },
      { id: 'ventas', t: 'Ventas y facturación', ic: '▧', end: true },
      { id: 'ordenes', t: 'Órdenes de servicio (OPI)', ic: '▩' },
      { id: 'consultas', t: 'Consultas web', ic: '◫', badge: 'consultasNuevas' },
      { id: 'catalogo', t: 'Catálogo web', ic: '◪' },
    ],
  },
  { id: 'pagos', t: 'Pagos y CxC', ic: '▨', badge: 'cxc' },
  {
    key: 'produccion',
    t: 'Producción',
    ic: '⚙',
    items: [
      { id: 'produccion', t: 'Órdenes de producción', ic: '⚙', tab: 'ordenes', tabDefault: true },
      { id: 'produccion', t: 'Lotes y calidad', ic: '✓', tab: 'lotes' },
      { id: 'produccion', t: 'Listas de materiales', ic: '☰', tab: 'bom' },
      { id: 'produccion', t: 'Rutas de producción', ic: '⤳', tab: 'rutas' },
    ],
  },
  { id: 'auditoria', t: 'Auditoría', ic: '◎' },
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

/** Colecciones del store que usa cada módulo: si alguna falla, la pantalla ofrece reintentar. */
export const MODULE_DATA: Record<ModuleId, RefreshKey[]> = {
  dashboard: ['dashboard'],
  productos: ['productos', 'catalogos'],
  inventario: ['productos', 'catalogos'],
  compras: ['compras', 'productos', 'proveedores'],
  produccion: ['productos'],
  clientes: ['clientes'],
  proveedores: ['proveedores'],
  cotizaciones: ['cotizaciones', 'clientes', 'productos'],
  ventas: ['ventas', 'clientes', 'productos'],
  pagos: ['pagos', 'cxc'],
  ordenes: ['ordenes'],
  reportes: [],
  catalogo: ['productos', 'catalogos'],
  consultas: ['consultas'],
  auditoria: [],
};

/**
 * Módulos que ve un usuario: el menú diseñado para su rol, limitado a lo que
 * sus permisos reales (enviados por el servidor) le permiten abrir.
 */
export function visibleModules(user: { role: RoleKey; permissions: string[] }): ModuleId[] {
  return ACCESS[user.role].filter((m) => user.permissions.includes(MODULE_PERMISSION[m]));
}
