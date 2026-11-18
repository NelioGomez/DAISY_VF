/* Barra de búsqueda y filtros con chips de filtros activos y "Limpiar filtros"
   (mejoras n.° 18 y 19). Se usa con useListFilters. */
import type { ReactNode } from 'react';
import type { FilterState } from '../../hooks/useListFilters';

interface FilterBarProps {
  f: FilterState & { count?: { shown: number; total: number } };
  placeholder: string;
  /** Etiqueta del rango de fechas ("Fecha", "Emitida"…). */
  dateLabel?: string;
  /** Botones u otros controles al final de la barra. */
  children?: ReactNode;
}

export function FilterBar({ f, placeholder, dateLabel = 'Fecha', children }: FilterBarProps) {
  const selects = f.selects;
  return (
    <>
      <div className="toolbar">
        <div className="search">
          <input value={f.q} placeholder={placeholder} aria-label={placeholder} onChange={(e) => f.setQ(e.target.value)} />
        </div>
        {selects.map((s) => (
          <select
            key={s.key}
            className={`toolbar-select ${f.values[s.key] ? 'is-on' : ''}`}
            value={f.values[s.key] ?? ''}
            onChange={(e) => f.setValue(s.key, e.target.value)}
            aria-label={s.label}
          >
            <option value="">{s.label}: todos</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {f.hasDate && (
          <span className="date-range" role="group" aria-label={`${dateLabel}: rango`}>
            <label>
              <span>{dateLabel} desde</span>
              <input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => f.setDesde(e.target.value)} />
            </label>
            <label>
              <span>hasta</span>
              <input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => f.setHasta(e.target.value)} />
            </label>
          </span>
        )}
        {children}
      </div>
      {f.active.length > 0 && (
        <div className="filter-chips" role="region" aria-label="Filtros activos">
          {f.active.map((a) => (
            <button key={a.key} type="button" className="chip active" onClick={a.clear} aria-label={`Quitar filtro ${a.label}`}>
              {a.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-btn clear-filters" onClick={f.clear}>
            Limpiar filtros
          </button>
          {f.count && (
            <span className="muted-sm" aria-live="polite">
              {f.count.shown} de {f.count.total}
            </span>
          )}
        </div>
      )}
    </>
  );
}
