/* Búsqueda global (mejora n.° 7): Ctrl + K desde cualquier pantalla del sistema interno.
   Busca en los módulos que el rol puede leer y abre el registro sin cambiar de pantalla
   (documentos y productos) o lleva a su módulo (clientes, proveedores, OPI). */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoTag } from '../../components/tables/Tag';
import { useModal } from '../../components/modals/useModal';
import { ProductImage } from '../../components/common/ProductImage';
import { api, errorMessage } from '../../services/api/client';
import {
  INQUIRY_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PURCHASE_STATUS,
  QUOTATION_STATUS,
  type ApiInquiryStatus,
  type ApiPaymentStatus,
  type ApiPurchaseStatus,
  type ApiQuotationStatus,
  type ApiServiceOrderStatus,
} from '../../services/api/mappers';
import { money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { useRecords } from '../records/records';

type Tipo = 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER' | 'SALE' | 'QUOTATION' | 'INQUIRY' | 'PURCHASE' | 'SERVICE_ORDER' | 'PRODUCTION_ORDER' | 'PRODUCTION_LOT';

interface Hit {
  tipo: Tipo;
  id: string;
  codigo: string;
  titulo: string;
  detalle: string;
  estado: string | null;
  monto: number | null;
  imagen: string | null;
}

const GROUPS: Array<[Tipo, string]> = [
  ['PRODUCT', 'Productos'],
  ['CUSTOMER', 'Clientes'],
  ['SALE', 'Ventas'],
  ['QUOTATION', 'Cotizaciones'],
  ['INQUIRY', 'Solicitudes web'],
  ['PURCHASE', 'Compras'],
  ['PRODUCTION_ORDER', 'Órdenes de producción'],
  ['PRODUCTION_LOT', 'Lotes de producción'],
  ['SERVICE_ORDER', 'Órdenes OPI'],
  ['SUPPLIER', 'Proveedores'],
];

const PRODUCTION_STATUS: Record<string, string> = { DRAFT: 'Borrador', RELEASED: 'Liberada', IN_PROGRESS: 'En proceso', COMPLETED: 'Terminada', CANCELLED: 'Cancelada' };
const LOT_STATUS: Record<string, string> = { PENDING_QC: 'Por inspeccionar', REWORK: 'En retrabajo', RELEASED: 'Liberado', SCRAPPED: 'Desechado' };

/* eslint-disable @typescript-eslint/no-explicit-any */
function estado(tipo: Tipo, s: any): string | null {
  if (!s) return null;
  if (tipo === 'SALE') return s === 'VOIDED' ? 'Anulada' : (PAYMENT_STATUS[s as ApiPaymentStatus] ?? null);
  if (tipo === 'QUOTATION') return QUOTATION_STATUS[s as ApiQuotationStatus] ?? null;
  if (tipo === 'INQUIRY') return INQUIRY_STATUS[s as ApiInquiryStatus] ?? null;
  if (tipo === 'PURCHASE') return PURCHASE_STATUS[s as ApiPurchaseStatus] ?? null;
  if (tipo === 'SERVICE_ORDER') return ORDER_STATUS[s as ApiServiceOrderStatus] ?? null;
  if (tipo === 'PRODUCTION_ORDER') return PRODUCTION_STATUS[s] ?? null;
  if (tipo === 'PRODUCTION_LOT') return LOT_STATUS[s] ?? null;
  return null;
}

const toHit = (r: any): Hit => ({
  imagen: r.imageUrl ?? null,
  tipo: r.type,
  id: String(r.id),
  codigo: r.code ?? '',
  titulo: String(r.title ?? ''),
  detalle: r.subtitle ?? '',
  estado: estado(r.type, r.status),
  monto: typeof r.amount === 'number' ? r.amount : null,
});

type State = { q: string; hits: Hit[] } | { q: string; error: string };

export function GlobalSearch() {
  const modal = useModal();
  const { openRecord } = useRecords();
  const navigate = useNavigate();
  const { open: openDoc } = useOpenDocument();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const query = q.trim();

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    if (query.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      api
        .get<{ results: unknown[] }>('/search', { q: query, limit: 5 })
        .then((r) => alive && setState({ q: query, hits: (r?.results ?? []).map(toHit) }))
        .catch((e) => alive && setState({ q: query, error: errorMessage(e) }));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const current = state && state.q === query ? state : null;
  const hits = current && 'hits' in current ? GROUPS.flatMap(([tipo]) => current.hits.filter((h) => h.tipo === tipo)) : [];
  const sel = Math.min(active, Math.max(hits.length - 1, 0));

  const choose = (h: Hit) => {
    switch (h.tipo) {
      case 'SALE':
        return openDoc({ tipo: 'VENTA', id: h.id, codigo: h.codigo });
      case 'QUOTATION':
        return openDoc({ tipo: 'COTIZACION', id: h.id, codigo: h.codigo });
      case 'INQUIRY':
        return openDoc({ tipo: 'SOLICITUD', id: h.id, codigo: h.codigo });
      case 'PURCHASE':
        return openDoc({ tipo: 'COMPRA', id: h.id, codigo: h.codigo });
      case 'PRODUCT':
        return openRecord('producto', h.id);
      case 'CUSTOMER':
        return openRecord('cliente', h.id);
      case 'SUPPLIER':
        return openRecord('proveedor', h.id);
      case 'SERVICE_ORDER':
        modal.close();
        return navigate('/app/ordenes');
      case 'PRODUCTION_ORDER':
        return openDoc({ tipo: 'PRODUCCION', id: h.id, codigo: h.codigo });
      case 'PRODUCTION_LOT':
        return openDoc({ tipo: 'LOTE', id: h.id, codigo: h.codigo });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return modal.close();
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((sel + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((sel - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(hits[sel]);
    }
  };

  let lastTipo: Tipo | null = null;
  return (
    <div className="modal-bg cmdk-bg" onClick={(e) => e.target === e.currentTarget && modal.close()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <div className="cmdk-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Buscar productos, clientes, facturas, cotizaciones…"
            aria-label="Buscar en todo el sistema"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="cmdk-list"
            aria-activedescendant={hits.length ? `cmdk-${sel}` : undefined}
            maxLength={100}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-body" id="cmdk-list" role="listbox" aria-label="Resultados">
          {query.length < 2 ? (
            <p className="cmdk-hint">Escriba al menos 2 caracteres: nombre, SKU, RUC, número de factura (FAC-) o código de cotización (COT-), solicitud (SOL-) o compra (OC-).</p>
          ) : !current ? (
            <p className="cmdk-hint" aria-live="polite">
              Buscando…
            </p>
          ) : 'error' in current ? (
            <p className="cmdk-hint is-error" role="alert">
              {current.error}
            </p>
          ) : !hits.length ? (
            <p className="cmdk-hint" aria-live="polite">
              Sin resultados para “{query}”.
            </p>
          ) : (
            hits.map((h, i) => {
              const header = h.tipo !== lastTipo ? GROUPS.find(([t]) => t === h.tipo)?.[1] : null;
              lastTipo = h.tipo;
              return (
                <div key={`${h.tipo}-${h.id}`}>
                  {header && <div className="cmdk-group">{header}</div>}
                  <button
                    type="button"
                    id={`cmdk-${i}`}
                    role="option"
                    aria-selected={i === sel}
                    className={`cmdk-item ${i === sel ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(h)}
                  >
                    {h.tipo === 'PRODUCT' && <ProductImage src={h.imagen} size={30} />}
                    {h.codigo && <span className="mono code">{h.codigo}</span>}
                    <span className="main">
                      <b>{h.titulo}</b>
                      {h.detalle && <small>{h.detalle}</small>}
                    </span>
                    {h.estado && <EstadoTag estado={h.estado} />}
                    {h.monto !== null && <span className="mono amt">{money(h.monto)}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
