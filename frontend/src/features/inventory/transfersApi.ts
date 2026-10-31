/* Traslados entre la bodega y la sucursal (mejora n.° 23): GET/POST /inventory/transfers. */
import { api, getAll } from '../../services/api/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export interface Traslado {
  id: string;
  codigo: string;
  origenId: number;
  origen: string;
  destinoId: number;
  destino: string;
  nota: string;
  usuario: string;
  fecha: string;
  unidades: number;
  valor: number;
  lineas: Array<{ prodId: string; sku: string; nombre: string; cant: number; costo: number }>;
}

const mapTraslado = (t: Json): Traslado => ({
  id: String(t.id),
  codigo: String(t.code ?? ''),
  origenId: Number(t.from?.id) || 1,
  origen: String(t.from?.name ?? ''),
  destinoId: Number(t.to?.id) || 2,
  destino: String(t.to?.name ?? ''),
  nota: String(t.note ?? ''),
  usuario: String(t.user ?? ''),
  fecha: String(t.createdAt ?? ''),
  unidades: Number(t.units) || 0,
  valor: Number(t.value) || 0,
  lineas: (t.items ?? []).map((i: Json) => ({
    prodId: String(i.product?.id ?? ''),
    sku: String(i.product?.sku ?? ''),
    nombre: String(i.product?.name ?? ''),
    cant: Number(i.quantity) || 0,
    costo: Number(i.unitCost) || 0,
  })),
});

export interface TrasladoInput {
  origenId: number;
  destinoId: number;
  lineas: Array<{ prodId: string; cant: number }>;
  nota: string;
}

export const trasladosApi = {
  lista: () => getAll<Json>('/inventory/transfers', {}, 5).then((r) => r.items.map(mapTraslado)),
  detalle: (id: string) => api.get<Json>(`/inventory/transfers/${id}`).then(mapTraslado),
  crear: (d: TrasladoInput) =>
    api
      .post<Json>('/inventory/transfers', {
        fromLocationId: d.origenId,
        toLocationId: d.destinoId,
        items: d.lineas.map((l) => ({ productId: l.prodId, quantity: l.cant })),
        ...(d.nota.trim() ? { note: d.nota.trim() } : {}),
      })
      .then(mapTraslado),
};
