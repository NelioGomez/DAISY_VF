/* Piezas compartidas del catálogo público: disponibilidad, precio, imagen y
   el control para agregar a la lista de cotización. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../../utils/format';
import type { Disponibilidad, ProductoPublico } from '../../types';
import { useQuoteList } from '../portal/useCustomer';
import { CategoryIcon } from './CategoryIcon';

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
  return p.imagen ? (
    <img src={p.imagen} alt={p.nombre} loading="lazy" />
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

export function ProductCard({ p }: { p: ProductoPublico }) {
  return (
    <article className="pub-card">
      <Link to={`/catalogo/${p.id}`} className="pub-card-media" tabIndex={-1} aria-hidden="true">
        <ProductMedia p={p} />
      </Link>
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
      </div>
    </article>
  );
}
