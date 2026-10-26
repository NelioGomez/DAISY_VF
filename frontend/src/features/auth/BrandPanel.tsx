/* Panel de marca del login: nombre del sistema y la manguera de surtidor
   que se dibuja una sola vez al cargar (único movimiento de la pantalla). */

export function BrandPanel() {
  return (
    <aside className="auth-brand" aria-label="SIVEN">
      <svg className="auth-hose" viewBox="0 0 600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path
          className="auth-hose-line"
          pathLength={1}
          d="M-40 790 C 110 720 170 880 330 815 S 560 650 480 520 S 300 400 660 330"
        />
        <path
          className="auth-hose-shine"
          pathLength={1}
          d="M-40 790 C 110 720 170 880 330 815 S 560 650 480 520 S 300 400 660 330"
        />
      </svg>

      <div className="auth-brand-top">
        <p className="auth-wordmark">SIVEN</p>
        <p className="auth-expansion">Sistema de Inventario y Ventas</p>
        <p className="auth-pitch">Inventario, cotizaciones, ventas y cobros de NORCOR en un mismo lugar.</p>
      </div>

      <div className="auth-brand-foot">
        <span className="auth-mark" aria-hidden="true">
          N
        </span>
        <span>NORCOR Fueling System</span>
      </div>
    </aside>
  );
}
