/* =====================================================================
   Sitio público (/api/v1/public): sin sesión.
   Nunca recibe costos, stock exacto, proveedores ni movimientos.
   ===================================================================== */
import { WHATSAPP_NUMBER } from '../../config/business';
import { request, type Pagination } from '../api/client';
import { mapProductoPublico } from '../portal/portalService';
import type { Disponibilidad, ProductoPublico } from '../../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export interface Empresa {
  nombre: string;
  telefono: string;
  correo: string;
  whatsapp: string;
  direccion: string;
  horario: string;
}

export interface CategoriaPublica {
  id: string;
  nombre: string;
  productos: number;
  /** Precio más bajo publicado en la categoría. */
  desde: number | null;
}

export interface MarcaPublica {
  id: string;
  nombre: string;
}

export interface InfoPublica {
  empresa: Empresa;
  categorias: CategoriaPublica[];
  marcas: MarcaPublica[];
}

export type Orden = 'nombre' | 'precio-asc' | 'precio-desc' | 'vendidos';

export interface FiltroCatalogo {
  q?: string;
  categoria?: string;
  marca?: string;
  disponibilidad?: Disponibilidad;
  min?: number;
  max?: number;
  orden?: Orden;
  page?: number;
  limit?: number;
}

const AVAILABILITY_API: Record<Disponibilidad, string> = { Disponible: 'AVAILABLE', 'Pocas unidades': 'LIMITED', 'Bajo pedido': 'OUT_OF_STOCK' };

const ORDEN_API: Record<Orden, { sortBy: string; sortOrder?: string }> = {
  nombre: { sortBy: 'name', sortOrder: 'asc' },
  'precio-asc': { sortBy: 'price', sortOrder: 'asc' },
  'precio-desc': { sortBy: 'price', sortOrder: 'desc' },
  vendidos: { sortBy: 'popular' },
};

export async function productos(f: FiltroCatalogo): Promise<{ items: ProductoPublico[]; pagination: Pagination }> {
  const r = await request<Json[]>('GET', '/public/products', {
    auth: false,
    query: {
      page: f.page ?? 1,
      limit: f.limit ?? 12,
      search: f.q?.trim() || undefined,
      categoryId: f.categoria,
      brandId: f.marca,
      availability: f.disponibilidad ? AVAILABILITY_API[f.disponibilidad] : undefined,
      minPrice: f.min,
      maxPrice: f.max,
      ...ORDEN_API[f.orden ?? 'nombre'],
    },
  });
  const items = (r.data ?? []).map(mapProductoPublico);
  return { items, pagination: r.pagination ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 } };
}

export async function producto(id: string): Promise<{ producto: ProductoPublico; relacionados: ProductoPublico[] }> {
  const r = await request<Json>('GET', `/public/products/${encodeURIComponent(id)}`, { auth: false });
  return { producto: mapProductoPublico(r.data), relacionados: (r.data?.related ?? []).map(mapProductoPublico) };
}

/* ---------- Datos de la empresa, categorías y marcas (se piden una vez por visita) ---------- */

let info: Promise<InfoPublica> | null = null;

export function infoPublica(): Promise<InfoPublica> {
  info ??= Promise.all([
    request<Json>('GET', '/public/settings', { auth: false }),
    request<Json[]>('GET', '/public/categories', { auth: false }),
    request<Json[]>('GET', '/public/brands', { auth: false }),
  ])
    .then(([s, c, b]) => ({
      empresa: {
        nombre: String(s.data?.name || 'NORCOR Fueling System'),
        telefono: String(s.data?.phone ?? ''),
        correo: String(s.data?.email ?? ''),
        whatsapp: String(s.data?.whatsapp ?? ''),
        direccion: String(s.data?.address ?? ''),
        horario: String(s.data?.hours ?? ''),
      },
      categorias: (c.data ?? []).map((x: Json) => ({
        id: String(x.id),
        nombre: String(x.name),
        productos: Number(x.productCount ?? 0),
        desde: x.minPrice === null || x.minPrice === undefined ? null : Number(x.minPrice),
      })),
      marcas: (b.data ?? []).map((x: Json) => ({ id: String(x.id), nombre: String(x.name) })),
    }))
    .catch((e) => {
      info = null; // se reintenta en la próxima visita a una página
      throw e;
    });
  return info;
}

/** Enlace de WhatsApp con un mensaje ya escrito (número de la configuración de la empresa). */
export function whatsappUrl(empresa: Empresa | null | undefined, texto: string): string {
  const digits = (empresa?.whatsapp || WHATSAPP_NUMBER).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(texto)}`;
}

/** Formulario de contacto anónimo: queda como consulta Nueva en el sistema interno. */
export async function enviarContacto(d: { nombre: string; contacto: string; producto: string; mensaje: string; website: string }): Promise<string | null> {
  const r = await request<{ code?: string }>('POST', '/public/inquiries', {
    auth: false,
    body: {
      name: d.nombre.trim(),
      contact: d.contacto.trim(),
      ...(d.producto.trim() ? { productInterest: d.producto.trim() } : {}),
      ...(d.mensaje.trim() ? { message: d.mensaje.trim() } : {}),
      ...(d.website ? { website: d.website } : {}),
    },
  });
  return r.data?.code ?? null;
}
