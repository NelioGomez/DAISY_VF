/* Piezas compartidas del catálogo público: disponibilidad, precio, imagen y
   el control para agregar a la lista de cotización. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../../utils/format';
import { imageSrc } from '../../utils/images';
import type { Disponibilidad, ProductoPublico } from '../../types';
import { useQuoteList } from '../portal/useCustomer';
import { CategoryIcon } from './CategoryIcon';
import { MAX_COMPARE, quickView, useCompare } from './compareStore';

const AVAIL: Record<Disponibilidad, { cls: string; icon: ReactNode; help: string }> = {
  Disponible: { cls: 'is-ok', icon: <path d="M3.5 8.5l3 3 6-7" />, help: 'Hay existencias para entrega inmediata.' },
  'Pocas unidades': {
    cls: 'is-low',
    icon: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="currentColor" />
      </>
    ),
    help: 'Quedan pocas unidades; confirme en su cotización.',
  },
  'Bajo pedido': {
    cls: 'is-order',
    icon: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.2l2.2 1.4" />
      </>
    ),
    help: 'Se trae a pedido; el vendedor le indicará el plazo.',
  },
};

/** Disponibilidad con ícono y texto (no depende solo del color). */
export function Availability({ value, withHelp }: { value: Disponibilidad; withHelp?: boolean }) {
  const a = AVAIL[value];
  return (
    <span className={`pub-avail ${a.cls}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {a.icon}
      </svg>
      {value}
      {withHelp && <small>{a.help}</small>}
    </span>
  );
}

export function Price({ value, unidad }: { value: number | null; unidad?: string }) {
  if (value === null) return <span className="pub-price is-ask">Precio a consultar</span>;
  return (
    <span className="pub-price">
      {money(value)}
      {unidad && <small> por {unidad}</small>}
    </span>
  );
}

export function ProductMedia({ p, size = 56 }: { p: Pick<ProductoPublico, 'imagen' | 'nombre' | 'categoria'>; size?: number }) {
  // Foto real (mejora n.° 4); si no hay o no carga, el ícono de la categoría.
  const src = imageSrc(p.imagen);
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img src={src} alt={p.nombre} loading="lazy" decoding="async" onError={() => setFailed(src)} />
  ) : (
    <span className="pub-media-ph">
      <CategoryIcon categoria={p.categoria} size={size} />
    </span>
  );
}

/** "Agregar a la lista"; si el producto ya está, se vuelve un selector de cantidad. */
export function AddToList({ p, big }: { p: ProductoPublico; big?: boolean }) {
  const lista = useQuoteList();
  const linea = lista.lineas.find((l) => l.id === p.id);
  if (!linea)
    return (
      <button type="button" className={`pub-btn ${big ? 'pub-btn-amber is-big' : 'pub-btn-soft pub-add'}`} onClick={() => lista.agregar(p)}>
        Agregar a la lista
      </button>
    );
  return (
    <div className={`pub-inlist ${big ? 'is-big' : ''}`}>
      <Stepper value={linea.cant} label={`Cantidad de ${p.nombre} en su lista`} onChange={(cant) => lista.cambiar(p.id, { cant })} />
      <button type="button" className="pub-inlist-open" onClick={() => lista.setAbierta(true)}>
        <span aria-hidden="true">✓</span> En su lista
      </button>
    </div>
  );
}

/** Selector de cantidad −/+ con campo editable. Llegar a 0 quita el producto. */
export function Stepper({ value, onChange, label }: { value: number; onChange(n: number): void; label: string }) {
  return (
    <div className="pub-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label={value <= 1 ? 'Quitar de la lista' : 'Una unidad menos'}>
        {value <= 1 ? '×' : '−'}
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={10000}
        value={value}
        aria-label="Cantidad"
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          if (Number.isFinite(n) && n >= 1) onChange(n);
        }}
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Una unidad más">
        +
      </button>
    </div>
  );
}

/** Marca el producto para el comparador (mejora n.° 38); hasta 4 a la vez. */
export function CompareToggle({ p }: { p: ProductoPublico }) {
  const cmp = useCompare();
  const on = cmp.has(p.id);
  const blocked = !on && cmp.full;
  return (
    <button
      type="button"
      className={`pub-compare ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      disabled={blocked}
      title={blocked ? `Ya eligió ${MAX_COMPARE} productos para comparar` : undefined}
      onClick={() => cmp.toggle(p)}
    >
      <span className="pub-compare-box" aria-hidden="true">
        {on ? '✓' : ''}
      </span>
      {on ? 'En la comparación' : 'Comparar'}
    </button>
  );
}

export function ProductCard({ p }: { p: ProductoPublico }) {
  return (
    <article className="pub-card">
      <div className="pub-card-top">
        <Link to={`/catalogo/${p.id}`} className="pub-card-media" tabIndex={-1} aria-hidden="true">
          <ProductMedia p={p} />
        </Link>
        {/* Vista rápida (mejora n.° 34): lo esencial sin salir de la lista. */}
        <button type="button" className="pub-quick" onClick={() => quickView.open(p)} aria-label={`Vista rápida de ${p.nombre}`} aria-haspopup="dialog">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Vista rápida</span>
        </button>
      </div>
      <div className="pub-card-body">
        <div className="pub-card-meta">
          {p.marca && <span>{p.marca}</span>}
          <span className="pub-sku">{p.sku}</span>
        </div>
        <h3>
          <Link to={`/catalogo/${p.id}`}>{p.nombre}</Link>
        </h3>
        <Price value={p.precio} unidad={p.unidad} />
        <Availability value={p.disponibilidad} />
        <AddToList p={p} />
        <CompareToggle p={p} />
      </div>
    </article>
  );
}
