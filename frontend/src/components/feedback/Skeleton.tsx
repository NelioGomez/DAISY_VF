/* Esqueletos de carga (mejora n.° 27): muestran la forma de lo que viene en lugar de un
   spinner, para que la pantalla no "salte" al llegar los datos. */

const width = (r: number, c: number) => `${45 + ((r * 7 + c * 13) % 45)}%`;

/** Filas de tabla en gris mientras llega la información. */
export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      <tr className="sr-only">
        <td colSpan={cols} role="status">
          Cargando datos…
        </td>
      </tr>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="sk-row" aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <span className="sk" style={{ width: width(r, c) }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Tarjetas KPI en gris. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi sk-card" aria-hidden="true">
          <span className="sk" style={{ width: '45%' }} />
          <span className="sk sk-lg" style={{ width: '60%' }} />
          <span className="sk" style={{ width: '75%' }} />
        </div>
      ))}
    </>
  );
}

/** Tabla completa en gris (paneles que cargan sus propios datos). */
export function SkeletonTable({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} aria-hidden="true">
                <span className="sk" style={{ width: width(0, c), opacity: 0.6 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SkeletonRows cols={cols} rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

/** Forma de una pantalla del sistema mientras llega la carga inicial: título, tarjetas y tabla. */
export function SkeletonPage() {
  return (
    <div className="sk-page" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando datos del servidor…
      </span>
      <div className="sk-head" aria-hidden="true">
        <span className="sk sk-lg" style={{ width: 220 }} />
        <span className="sk" style={{ width: '55%' }} />
      </div>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <SkeletonCards count={4} />
      </div>
      <SkeletonTable cols={6} rows={7} />
    </div>
  );
}
