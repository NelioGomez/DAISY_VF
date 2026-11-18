/* =====================================================================
   Manufactura (entrega 2): BOM, rutas, órdenes de producción, lotes y calidad.
   El módulo trae sus propios datos de /production/* (no viven en el store
   global) y traduce aquí los códigos de la API a lo que ven las pantallas.
   ===================================================================== */
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, getAll } from '../../services/api/client';
import { subscribeRealtime } from '../../services/realtime/realtime';
import type { RefreshKey } from '../../store/storeContext';
import type { TipoMovimiento } from '../../types';
import { isUnidad, type Unidad } from '../../utils/units';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => Number(v) || 0;

/* ---------- Estados ---------- */

export type EstadoOP = 'Borrador' | 'Liberada' | 'En proceso' | 'Terminada' | 'Cancelada';
export type EstadoLote = 'Por inspeccionar' | 'En retrabajo' | 'Liberado' | 'Desechado';
export type Disposicion = 'REWORK' | 'SCRAP' | 'RELEASE';

const OP_STATUS: Record<string, EstadoOP> = {
  DRAFT: 'Borrador',
  RELEASED: 'Liberada',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Terminada',
  CANCELLED: 'Cancelada',
};

const LOT_STATUS: Record<string, EstadoLote> = {
  PENDING_QC: 'Por inspeccionar',
  REWORK: 'En retrabajo',
  RELEASED: 'Liberado',
  SCRAPPED: 'Desechado',
};

/** Qué se hace con las unidades no conformes. */
export const DISPOSICIONES: Array<{ id: Disposicion; nombre: string; ayuda: string }> = [
  { id: 'REWORK', nombre: 'Retrabajo', ayuda: 'Se corrigen y vuelven a inspección; mientras tanto no entran al inventario.' },
  { id: 'SCRAP', nombre: 'Scrap (desecho)', ayuda: 'Se descartan: no entran al inventario y bajan el rendimiento.' },
  { id: 'RELEASE', nombre: 'Liberación por concesión', ayuda: 'Se aceptan con el defecto documentado y entran al inventario.' },
];

export const nombreDisposicion = (d: Disposicion | null) => DISPOSICIONES.find((x) => x.id === d)?.nombre ?? '—';

/* ---------- Tipos ---------- */

export interface ProductoRef {
  id: string;
  sku: string;
  nombre: string;
  unidad: Unidad;
  stock: number;
  costo: number;
  activo: boolean;
}

export interface LineaBom {
  id: string;
  componente: ProductoRef;
  /** Por cada unidad del producto terminado. */
  cantidad: number;
  notas: string;
  costoLinea: number;
}

export interface ListaMateriales {
  id: string;
  codigo: string;
  version: number;
  vigente: boolean;
  notas: string;
  producto: ProductoRef;
  items: LineaBom[];
  /** Costo estándar de materiales por unidad con los costos promedio actuales. */
  costoUnitario: number;
  ordenes: number;
  fecha: string;
}

export interface Operacion {
  id: string;
  secuencia: number;
  nombre: string;
  centro: string;
  minutos: number;
  instrucciones: string;
}

export interface RutaProduccion {
  id: string;
  codigo: string;
  nombre: string;
  vigente: boolean;
  producto: ProductoRef;
  operaciones: Operacion[];
  minutosPorUnidad: number;
  ordenes: number;
  fecha: string;
}

export interface OrdenFila {
  id: string;
  codigo: string;
  estado: EstadoOP;
  producto: ProductoRef;
  bom: { id: string; codigo: string; version: number } | null;
  cantidad: number;
  producida: number;
  liberada: number;
  desechada: number;
  lotes: Array<{ id: string; codigo: string; estado: EstadoLote }>;
  pasosHechos: number;
  pasosTotal: number;
  inicioPlan: string | null;
  entrega: string | null;
  iniciada: string | null;
  terminada: string | null;
  fecha: string;
}

export interface Material {
  componente: ProductoRef;
  planificado: number;
  consumido: number;
  costoUnit: number;
  disponible: number;
  /** Lo que falta en bodega para poder iniciar (solo antes de iniciar). */
  faltante: number;
}

export interface Paso {
  id: string;
  secuencia: number;
  nombre: string;
  centro: string;
  minutos: number;
  hecho: boolean;
  fecha: string | null;
  por: string;
  notas: string;
}

export interface Inspeccion {
  id: string;
  codigo: string;
  etapa: 'Inicial' | 'Retrabajo';
  inspeccionadas: number;
  defectuosas: number;
  conforme: boolean;
  disposicion: Disposicion | null;
  defecto: string;
  notas: string;
  fecha: string;
  inspector: string;
}

export interface Lote {
  id: string;
  codigo: string;
  estado: EstadoLote;
  cantidad: number;
  pendiente: number;
  retrabajo: number;
  liberada: number;
  desechada: number;
  costoUnit: number;
  fecha: string;
  inspecciones: Inspeccion[];
  producto: ProductoRef | null;
  orden: { id: string; codigo: string; cantidad: number } | null;
}

export interface MovimientoOP {
  id: string;
  tipo: TipoMovimiento;
  sku: string;
  nombre: string;
  cantidad: number;
  costo: number;
  antes: number;
  despues: number;
  nota: string;
  lote: string;
  fecha: string;
}

export interface OrdenProduccion extends Omit<OrdenFila, 'lotes' | 'pasosHechos' | 'pasosTotal' | 'liberada' | 'desechada'> {
  ruta: { id: string; codigo: string; nombre: string } | null;
  liberadaEn: string | null;
  cancelada: string | null;
  motivoCancelacion: string;
  cicloHoras: number | null;
  costoMateriales: number;
  notas: string;
  creadaPor: string;
  materiales: Material[];
  pasos: Paso[];
  lotes: Lote[];
  movimientos: MovimientoOP[];
}

/* ---------- Mapeo ---------- */

const mapProducto = (p: Json): ProductoRef => ({
  id: s(p?.id),
  sku: s(p?.sku),
  nombre: s(p?.name),
  unidad: isUnidad(p?.unit) ? p.unit : 'UNIT',
  stock: n(p?.stock),
  costo: n(p?.avgCost),
  activo: p?.isActive !== false,
});

const mapBom = (b: Json): ListaMateriales => ({
  id: s(b.id),
  codigo: s(b.code),
  version: n(b.version),
  vigente: !!b.isActive,
  notas: s(b.notes),
  producto: mapProducto(b.product),
  items: (b.items ?? []).map((i: Json) => ({ id: s(i.id), componente: mapProducto(i.component), cantidad: n(i.quantity), notas: s(i.notes), costoLinea: n(i.lineCost) })),
  costoUnitario: n(b.unitMaterialCost),
  ordenes: n(b.ordersCount),
  fecha: s(b.createdAt),
});

const mapRuta = (r: Json): RutaProduccion => ({
  id: s(r.id),
  codigo: s(r.code),
  nombre: s(r.name),
  vigente: !!r.isActive,
  producto: mapProducto(r.product),
  operaciones: (r.operations ?? []).map((o: Json) => ({
    id: s(o.id),
    secuencia: n(o.sequence),
    nombre: s(o.name),
    centro: s(o.workCenter),
    minutos: n(o.standardMinutes),
    instrucciones: s(o.instructions),
  })),
  minutosPorUnidad: n(r.standardMinutesPerUnit),
  ordenes: n(r.ordersCount),
  fecha: s(r.createdAt),
});

const mapBomRef = (b: Json) => (b ? { id: s(b.id), codigo: s(b.code), version: n(b.version) } : null);

const mapOrdenFila = (o: Json): OrdenFila => ({
  id: s(o.id),
  codigo: s(o.code),
  estado: OP_STATUS[o.status] ?? 'Borrador',
  producto: mapProducto(o.product),
  bom: mapBomRef(o.bom),
  cantidad: n(o.quantity),
  producida: n(o.producedQuantity),
  liberada: n(o.releasedQuantity),
  desechada: n(o.scrappedQuantity),
  lotes: (o.lots ?? []).map((l: Json) => ({ id: s(l.id), codigo: s(l.code), estado: LOT_STATUS[l.status] ?? 'Por inspeccionar' })),
  pasosHechos: n(o.stepsDone),
  pasosTotal: n(o.stepsTotal),
  inicioPlan: o.plannedStart ?? null,
  entrega: o.dueDate ?? null,
  iniciada: o.startedAt ?? null,
  terminada: o.completedAt ?? null,
  fecha: s(o.createdAt),
});

const mapInspeccion = (i: Json): Inspeccion => ({
  id: s(i.id),
  codigo: s(i.code),
  etapa: i.stage === 'REWORK' ? 'Retrabajo' : 'Inicial',
  inspeccionadas: n(i.inspectedQuantity),
  defectuosas: n(i.defectiveQuantity),
  conforme: i.result !== 'NONCONFORMING',
  disposicion: (i.disposition as Disposicion | null) ?? null,
  defecto: s(i.defectDescription),
  notas: s(i.notes),
  fecha: s(i.inspectedAt),
  inspector: s(i.inspector),
});

const mapLote = (l: Json): Lote => ({
  id: s(l.id),
  codigo: s(l.code),
  estado: LOT_STATUS[l.status] ?? 'Por inspeccionar',
  cantidad: n(l.quantity),
  pendiente: n(l.pendingQuantity),
  retrabajo: n(l.reworkQuantity),
  liberada: n(l.releasedQuantity),
  desechada: n(l.scrappedQuantity),
  costoUnit: n(l.unitCost),
  fecha: s(l.producedAt),
  inspecciones: (l.inspections ?? []).map(mapInspeccion),
  producto: l.product ? mapProducto(l.product) : null,
  orden: l.order ? { id: s(l.order.id), codigo: s(l.order.code), cantidad: n(l.order.quantity) } : null,
});

const MOV: Record<string, TipoMovimiento> = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' };

const mapOrden = (o: Json): OrdenProduccion => ({
  ...mapOrdenFila({ ...o, lots: [] }),
  ruta: o.route ? { id: s(o.route.id), codigo: s(o.route.code), nombre: s(o.route.name) } : null,
  liberadaEn: o.releasedAt ?? null,
  cancelada: o.cancelledAt ?? null,
  motivoCancelacion: s(o.cancellationReason),
  cicloHoras: o.cycleHours === null || o.cycleHours === undefined ? null : n(o.cycleHours),
  costoMateriales: n(o.materialCost),
  notas: s(o.notes),
  creadaPor: s(o.createdBy),
  materiales: (o.materials ?? []).map((m: Json) => ({
    componente: mapProducto(m.component),
    planificado: n(m.plannedQuantity),
    consumido: n(m.consumedQuantity),
    costoUnit: n(m.unitCost),
    disponible: n(m.available),
    faltante: n(m.shortage),
  })),
  pasos: (o.steps ?? []).map((p: Json) => ({
    id: s(p.id),
    secuencia: n(p.sequence),
    nombre: s(p.name),
    centro: s(p.workCenter),
    minutos: n(p.standardMinutes),
    hecho: p.status === 'DONE',
    fecha: p.completedAt ?? null,
    por: s(p.completedBy),
    notas: s(p.notes),
  })),
  lotes: (o.lots ?? []).map(mapLote),
  movimientos: (o.movements ?? []).map((m: Json) => ({
    id: s(m.id),
    tipo: MOV[m.type] ?? 'Ajuste',
    sku: s(m.product?.sku),
    nombre: s(m.product?.name),
    cantidad: n(m.quantity),
    costo: n(m.unitCost),
    antes: n(m.stockBefore),
    despues: n(m.stockAfter),
    nota: s(m.note),
    lote: s(m.lotCode),
    fecha: s(m.createdAt),
  })),
});

/* ---------- Llamadas ---------- */

export interface OrdenInput {
  productoId: string;
  cantidad: number;
  inicioPlan?: string;
  entrega?: string;
  notas?: string;
}

export interface BomInput {
  productoId: string;
  items: Array<{ componenteId: string; cantidad: number }>;
  notas: string;
}

export interface RutaInput {
  productoId: string;
  nombre: string;
  operaciones: Array<{ nombre: string; centro: string; minutos: number; instrucciones: string }>;
}

export interface InspeccionInput {
  defectuosas: number;
  disposicion?: Disposicion;
  defecto?: string;
  notas?: string;
}

const opsToApi = (ops: RutaInput['operaciones']) =>
  ops.map((o) => ({ name: o.nombre.trim(), workCenter: o.centro.trim() || undefined, standardMinutes: o.minutos, instructions: o.instrucciones.trim() || undefined }));

export const produccionApi = {
  ordenes: () => getAll<Json>('/production/orders', {}, 5).then((r) => r.items.map(mapOrdenFila)),
  orden: (id: string) => api.get<Json>(`/production/orders/${id}`).then(mapOrden),
  crearOrden: (d: OrdenInput) =>
    api
      .post<Json>('/production/orders', {
        productId: d.productoId,
        quantity: d.cantidad,
        ...(d.inicioPlan && { plannedStart: d.inicioPlan }),
        ...(d.entrega && { dueDate: d.entrega }),
        ...(d.notas && { notes: d.notas }),
      })
      .then(mapOrden),
  liberar: (id: string) => api.post<Json>(`/production/orders/${id}/release`).then(mapOrden),
  /** Consume los materiales de la BOM (salidas de inventario al costo promedio). */
  iniciar: (id: string) => api.post<Json>(`/production/orders/${id}/start`).then(mapOrden),
  completarPaso: (id: string, pasoId: string, notas?: string) =>
    api.post<Json>(`/production/orders/${id}/steps/${pasoId}/complete`, notas ? { notes: notas } : {}).then(mapOrden),
  terminar: (id: string, producida: number, notas?: string) =>
    api.post<Json>(`/production/orders/${id}/complete`, { producedQuantity: producida, ...(notas && { notes: notas }) }).then(mapOrden),
  cancelar: (id: string, motivo: string) => api.post<Json>(`/production/orders/${id}/cancel`, { reason: motivo }).then(mapOrden),

  lotes: () => getAll<Json>('/production/lots', {}, 5).then((r) => r.items.map(mapLote)),
  lote: (id: string) => api.get<Json>(`/production/lots/${id}`).then(mapLote),
  inspeccionar: (id: string, d: InspeccionInput) =>
    api
      .post<Json>(`/production/lots/${id}/inspections`, {
        defectiveQuantity: d.defectuosas,
        ...(d.defectuosas > 0 && d.disposicion && { disposition: d.disposicion }),
        ...(d.defecto && { defectDescription: d.defecto }),
        ...(d.notas && { notes: d.notas }),
      })
      .then(mapLote),

  boms: () => api.get<Json[]>('/production/boms').then((rows) => (rows ?? []).map(mapBom)),
  /** Si la BOM ya se usó en órdenes, el servidor crea una versión nueva (devuelve `reemplaza`). */
  guardarBom: (id: string | null, d: BomInput) => {
    const items = d.items.map((i) => ({ componentId: i.componenteId, quantity: i.cantidad }));
    const notes = d.notas.trim() || undefined;
    return (id ? api.patch<Json>(`/production/boms/${id}`, { items, notes }) : api.post<Json>('/production/boms', { productId: d.productoId, items, notes })).then((b) => ({
      ...mapBom(b),
      reemplaza: s(b.replaced),
    }));
  },
  estadoBom: (id: string, vigente: boolean) => api.patch<Json>(`/production/boms/${id}/status`, { isActive: vigente }).then(mapBom),

  rutas: () => api.get<Json[]>('/production/routes').then((rows) => (rows ?? []).map(mapRuta)),
  guardarRuta: (id: string | null, d: RutaInput) =>
    (id
      ? api.patch<Json>(`/production/routes/${id}`, { name: d.nombre.trim(), operations: opsToApi(d.operaciones) })
      : api.post<Json>('/production/routes', { productId: d.productoId, name: d.nombre.trim(), operations: opsToApi(d.operaciones) })
    ).then(mapRuta),
  estadoRuta: (id: string, vigente: boolean) => api.patch<Json>(`/production/routes/${id}/status`, { isActive: vigente }).then(mapRuta),
};

/** Colecciones del store que cambian con producción (stock, kardex y KPI). */
export const KEYS_STOCK: RefreshKey[] = ['productos', 'movimientos', 'dashboard'];

/* ---------- Carga con recarga en tiempo real ---------- */

/**
 * Trae datos de producción y los vuelve a pedir cuando el servidor avisa de un cambio
 * en el módulo (otro usuario inició una orden, calidad liberó un lote…).
 * `load` debe ser estable (función del módulo o useCallback).
 */
export function useProduccion<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ load: () => Promise<T>; data?: T; error?: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ load, data }),
      (e) => alive && setState({ load, error: errorMessage(e) }),
    );
    return () => {
      alive = false;
    };
  }, [load, version]);

  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (e.module === 'production') setVersion((v) => v + 1);
      }),
    [],
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  /** Usa la respuesta de una acción (la API devuelve el documento actualizado). */
  const set = useCallback((data: T) => setState({ load, data }), [load]);
  const current = state && state.load === load ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? '', loading: !current, reload, set };
}
