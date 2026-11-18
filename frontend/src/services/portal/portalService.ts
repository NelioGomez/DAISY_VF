/* =====================================================================
   Portal de clientes (/api/v1/portal): sesión SEPARADA del personal.
   Usa su propio token (tipo "customer"), que el servidor no acepta en
   la API interna; el token del personal tampoco sirve aquí.
   ===================================================================== */
import { iconFor, INQUIRY_STATUS, INQUIRY_TYPE, ORDER_STATUS, QUOTATION_STATUS, type ApiInquiryStatus, type ApiInquiryType, type ApiQuotationStatus, type ApiServiceOrderStatus } from '../api/mappers';
import { ApiError, request } from '../api/client';
import type { CotizacionPortal, CuentaCliente, Disponibilidad, LineaLista, ProductoPublico, SolicitudPortal } from '../../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export const AVAILABILITY: Record<string, Disponibilidad> = { AVAILABLE: 'Disponible', LIMITED: 'Pocas unidades', OUT_OF_STOCK: 'Bajo pedido' };

export const mapProductoPublico = (p: Json): ProductoPublico => ({
  id: s(p.id),
  sku: s(p.sku),
  nombre: s(p.name),
  descripcion: s(p.description),
  marca: s(p.brand?.name),
  categoria: s(p.category?.name),
  categoriaId: p.category?.id ?? null,
  precio: p.price === null || p.price === undefined ? null : n(p.price),
  unidad: s(p.unit) || 'unidad',
  imagen: p.imageUrl ?? null,
  disponibilidad: AVAILABILITY[p.availability] ?? 'Disponible',
  garantiaDias: p.warrantyDays ? n(p.warrantyDays) : null,
  ic: iconFor(p.category?.name),
});

export const mapCuenta = (a: Json): CuentaCliente => ({
  id: s(a.id),
  email: s(a.email),
  contacto: s(a.contactName),
  telefono: s(a.phone),
  cliente: {
    id: s(a.customer?.id),
    nombre: s(a.customer?.name),
    ruc: s(a.customer?.ruc),
    telefono: s(a.customer?.phone),
    direccion: s(a.customer?.address),
  },
});

const mapSolicitud = (r: Json): SolicitudPortal => ({
  id: s(r.id),
  codigo: s(r.code),
  tipo: INQUIRY_TYPE[r.type as ApiInquiryType] ?? 'Cotización',
  estado: INQUIRY_STATUS[r.status as ApiInquiryStatus] ?? 'Nueva',
  estadoDesde: s(r.statusChangedAt ?? r.createdAt),
  fecha: s(r.createdAt),
  mensaje: s(r.message),
  items: (r.items ?? []).map((i: Json) => ({
    prod: s(i.productId),
    sku: s(i.sku),
    nombre: s(i.name),
    cant: n(i.quantity),
    nota: s(i.note),
    disponibilidad: AVAILABILITY[i.availability] ?? 'Disponible',
  })),
  cotizacion: r.quotation
    ? {
        id: s(r.quotation.id),
        codigo: s(r.quotation.code),
        estado: QUOTATION_STATUS[r.quotation.status as ApiQuotationStatus] ?? 'Pendiente',
        total: n(r.quotation.total),
        validaHasta: s(r.quotation.validUntil),
      }
    : null,
  enPreparacion: !!r.quotationInProgress,
  ordenServicio: r.serviceOrder
    ? {
        codigo: s(r.serviceOrder.code),
        estado: ORDER_STATUS[r.serviceOrder.status as ApiServiceOrderStatus] ?? 'Registrada',
        enGarantia: !!r.serviceOrder.underWarranty,
        garantiaHasta: r.serviceOrder.warrantyUntil ?? null,
      }
    : null,
});

const mapCotizacion = (q: Json): CotizacionPortal => ({
  id: s(q.id),
  codigo: s(q.code),
  estado: QUOTATION_STATUS[q.status as ApiQuotationStatus] ?? 'Pendiente',
  fecha: s(q.issuedAt),
  validaHasta: s(q.validUntil),
  sub: n(q.subtotal),
  iva: n(q.tax),
  total: n(q.total),
  notas: s(q.notes),
  vendedor: { nombre: s(q.seller?.name), correo: s(q.seller?.email) },
  solicitud: q.inquiry ? { id: s(q.inquiry.id), codigo: s(q.inquiry.code) } : null,
  factura: q.invoiceNumber ?? null,
  items: Array.isArray(q.items)
    ? q.items.map((i: Json) => ({ sku: s(i.sku), nombre: s(i.name), cant: n(i.quantity), precio: n(i.unitPrice), sub: n(i.subtotal) }))
    : undefined,
});

export interface PortalSession {
  token: string;
  expiresAt: number;
  cuenta: CuentaCliente;
}

const session = (r: Json): PortalSession => ({
  token: String(r.accessToken),
  expiresAt: Date.now() + n(r.expiresIn) * 1000,
  cuenta: mapCuenta(r.account),
});

/* ---------- Acceso ---------- */

export interface RegistroInput {
  empresa: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono: string;
  password: string;
}

export async function registrar(d: RegistroInput): Promise<PortalSession> {
  const r = await request<Json>('POST', '/portal/auth/register', {
    auth: false,
    body: {
      companyName: d.empresa.trim(),
      ...(d.ruc.trim() ? { ruc: d.ruc.trim() } : {}),
      contactName: d.contacto.trim(),
      email: d.email.trim().toLowerCase(),
      ...(d.telefono.trim() ? { phone: d.telefono.trim() } : {}),
      password: d.password,
    },
  });
  return session(r.data);
}

export async function ingresar(email: string, password: string): Promise<PortalSession> {
  const r = await request<Json>('POST', '/portal/auth/login', { auth: false, body: { email: email.trim().toLowerCase(), password } });
  return session(r.data);
}

/* ---------- Con sesión ---------- */

const get = async <T>(path: string, token: string) => (await request<T>('GET', path, { token })).data;

export const miCuenta = async (token: string) => mapCuenta(await get<Json>('/portal/me', token));

export async function actualizarPerfil(token: string, contacto: string, telefono: string): Promise<CuentaCliente> {
  const r = await request<Json>('PATCH', '/portal/me', { token, body: { contactName: contacto.trim(), phone: telefono.trim() || null } });
  return mapCuenta(r.data);
}

/** El cliente cambia su correo de acceso (mejora n.° 59). */
export async function cambiarCorreo(token: string, email: string, actual: string): Promise<CuentaCliente> {
  const r = await request<Json>('PATCH', '/portal/me/email', { token, body: { email: email.trim().toLowerCase(), currentPassword: actual } });
  return mapCuenta(r.data);
}

export async function cambiarClave(token: string, actual: string, nueva: string): Promise<PortalSession> {
  const r = await request<Json>('PATCH', '/portal/me/password', { token, body: { currentPassword: actual, newPassword: nueva } });
  return session(r.data);
}

export const misSolicitudes = async (token: string) => ((await get<Json[]>('/portal/inquiries', token)) ?? []).map(mapSolicitud);

export const misCotizaciones = async (token: string) => ((await get<Json[]>('/portal/quotations', token)) ?? []).map(mapCotizacion);

export const miCotizacion = async (token: string, id: string) => mapCotizacion(await get<Json>(`/portal/quotations/${id}`, token));

export async function enviarLista(token: string, lineas: LineaLista[], mensaje: string): Promise<SolicitudPortal> {
  const r = await request<Json>('POST', '/portal/inquiries', {
    token,
    body: {
      items: lineas.map((l) => ({ productId: l.id, quantity: l.cant, ...(l.nota.trim() ? { note: l.nota.trim() } : {}) })),
      ...(mensaje.trim() ? { message: mensaje.trim() } : {}),
    },
  });
  return mapSolicitud(r.data);
}

/** Mensaje de Contacto con la sesión del cliente: queda enlazado a su cuenta. */
export async function enviarMensaje(token: string, d: { tipo: ApiInquiryType; producto: string; mensaje: string }): Promise<SolicitudPortal> {
  const r = await request<Json>('POST', '/portal/contact', {
    token,
    body: { type: d.tipo, message: d.mensaje.trim(), ...(d.producto.trim() ? { productInterest: d.producto.trim() } : {}) },
  });
  return mapSolicitud(r.data);
}

/** ¿El error es de sesión vencida o inválida? */
export const isSessionError = (e: unknown) => e instanceof ApiError && e.status === 401;
