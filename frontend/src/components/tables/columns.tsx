/* Piezas de tabla para las columnas configurables (mejora n.° 21); la lógica está en useColumns.ts. */
import { useEffect, useRef, useState } from 'react';
import type { ColumnsApi } from './useColumns';

/** Encabezados de las columnas visibles, en el orden elegido. */
export function ColumnHeads<T>({ cols }: { cols: ColumnsApi<T> }) {
  return (
    <>
      {cols.visible.map((c) => (
        <th key={c.id} className={c.className}>
          {c.header ?? c.label}
        </th>
      ))}
    </>
  );
}

/** Celdas de una fila para las columnas visibles. */
export function ColumnCells<T>({ cols, row }: { cols: ColumnsApi<T>; row: T }) {
  return (
    <>
      {cols.visible.map((c) => (
        <td key={c.id} className={[c.className, c.cellClass].filter(Boolean).join(' ') || undefined} {...c.tdProps?.(row)}>
          {c.cell(row)}
        </td>
      ))}
    </>
  );
}

/** Botón "Columnas" con la lista para mostrar, ocultar y reordenar. */
export function ColumnsButton<T>({ cols }: { cols: ColumnsApi<T> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    // Esc cierra solo el menú (no la ventana o el panel que haya debajo).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const hiddenCount = cols.all.length - cols.visible.length;
  return (
    <div className="cols-menu" ref={box}>
      <button
        ref={button}
        type="button"
        className={`b b-out cols-btn ${cols.customized ? 'is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="Mostrar, ocultar y ordenar columnas"
      >
        <span aria-hidden="true">☷</span> Columnas{hiddenCount > 0 && <span className="cols-count"> ({cols.visible.length}/{cols.all.length})</span>}
      </button>
      {open && (
        <div className="cols-pop" role="dialog" aria-label="Columnas de la tabla">
          <p className="cols-title">Mostrar y ordenar columnas</p>
          <ul>
            {cols.all.map((c, i) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={c.shown} disabled={c.required} onChange={() => cols.toggle(c.id)} />
                  <span>{c.label}</span>
                </label>
                <span className="cols-move">
                  <button type="button" disabled={i === 0} onClick={() => cols.move(c.id, -1)} aria-label={`Mover ${c.label} a la izquierda`} title="Mover a la izquierda">
                    ↑
                  </button>
                  <button type="button" disabled={i === cols.all.length - 1} onClick={() => cols.move(c.id, 1)} aria-label={`Mover ${c.label} a la derecha`} title="Mover a la derecha">
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="cols-foot">
            <span className="muted-sm">
              {cols.visible.length} de {cols.all.length} visibles
            </span>
            <button type="button" className="link-btn" onClick={cols.reset} disabled={!cols.customized}>
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
