/* Rotación de inventario (mejoras n.° 11 y 12): mismas etiquetas en la ficha y en Inventario. */
import type { TagTone } from '../../components/tables/Tag';
import { request } from '../../services/api/client';
import type { Rotacion } from '../../types';

export const ROTACION: Record<Rotacion, { txt: string; corto: string; tone: TagTone; ic: string; ayuda: string }> = {
  ALTA: { txt: 'Rotación alta', corto: 'Alta', tone: 't-green', ic: '▲', ayuda: 'el stock alcanza 30 días o menos' },
  MEDIA: { txt: 'Rotación media', corto: 'Media', tone: 't-blue', ic: '◆', ayuda: 'alcanza de 31 a 90 días' },
  BAJA: { txt: 'Rotación baja', corto: 'Baja', tone: 't-amber', ic: '▼', ayuda: 'alcanza más de 90 días' },
  SIN_MOVIMIENTO: { txt: 'Sin movimiento (90 d)', corto: 'Sin movimiento', tone: 't-gray', ic: '○', ayuda: 'sin ventas ni consumo en 90 días' },
};

export const CLASES: Rotacion[] = ['ALTA', 'MEDIA', 'BAJA', 'SIN_MOVIMIENTO'];

export interface FilaRotacion {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  marca: string;
  stock: number;
  stockMin: number;
  valor: number;
  /** Uso = ventas + consumo en producción. */
  vendidas30: number;
  vendidas90: number;
  /** Parte del uso de 90 días que consumió producción. */
  consumidas90: number;
  porDia: number;
  /** Días que alcanza el stock al ritmo de los últimos 90 días (null = sin ventas). */
  dias: number | null;
  rotacion: Rotacion;
  /** Última venta o consumo en producción. */
  ultimaVenta: string | null;
}

export interface ResumenRotacion {
  filas: FilaRotacion[];
  porClase: Record<Rotacion, { productos: number; unidades: number; valor: number }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export const cargarRotacion = (): Promise<ResumenRotacion> =>
  request<Json[]>('GET', '/inventory/rotation').then((r) => {
    const s = (r.summary ?? {}) as Json;
    return {
      filas: (r.data ?? []).map((x: Json) => ({
        id: String(x.id),
        sku: String(x.sku ?? ''),
        nombre: String(x.name ?? ''),
        categoria: String(x.category ?? ''),
        marca: String(x.brand ?? ''),
        stock: Number(x.stock) || 0,
        stockMin: Number(x.minStock) || 0,
        valor: Number(x.stockValue) || 0,
        vendidas30: Number(x.unitsLast30Days) || 0,
        vendidas90: Number(x.unitsLast90Days) || 0,
        consumidas90: Number(x.consumedLast90Days) || 0,
        porDia: Number(x.dailyRate) || 0,
        dias: x.daysOfCover === null || x.daysOfCover === undefined ? null : Number(x.daysOfCover),
        rotacion: (CLASES.includes(x.rotation) ? x.rotation : 'SIN_MOVIMIENTO') as Rotacion,
        ultimaVenta: x.lastUseAt ?? x.lastSaleAt ?? null,
      })),
      porClase: Object.fromEntries(
        CLASES.map((k) => [k, { productos: Number(s[k]?.products) || 0, unidades: Number(s[k]?.units) || 0, valor: Number(s[k]?.value) || 0 }]),
      ) as ResumenRotacion['porClase'],
    };
  });
