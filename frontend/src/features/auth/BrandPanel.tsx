/* Panel de marca de las pantallas de acceso: nombre del sistema, lo que
   resuelve y la manguera de surtidor que se dibuja una sola vez al cargar. */
import type { ReactNode } from 'react';
import { BoxIcon, ChartIcon, ClipboardIcon, FileIcon, WalletIcon, WrenchIcon } from './icons';

const AREAS: Array<{ icon: ReactNode; title: string; desc: string }> = [
  { icon: <BoxIcon />, title: 'Inventario al día', desc: 'Existencias, entradas y alertas de stock mínimo.' },
  { icon: <FileIcon />, title: 'Cotizaciones y ventas', desc: 'De la proforma a la factura sin volver a digitar.' },
  { icon: <WalletIcon />, title: 'Cobros y crédito', desc: 'Saldos, abonos y facturas por vencer.' },
  { icon: <WrenchIcon />, title: 'Órdenes de servicio', desc: 'Seguimiento técnico de cada trabajo.' },
  { icon: <ChartIcon />, title: 'Reportes', desc: 'Ventas, márgenes y productos de mayor salida.' },
  { icon: <ClipboardIcon />, title: 'Auditoría', desc: 'Quién hizo qué y cuándo, en cada módulo.' },
];

const HOSE = 'M360 960 C 110 880 40 720 160 600 S 310 400 150 290 S 30 110 360 -60';

export function BrandPanel() {
  return (
    <aside className="auth-brand" aria-label="SIVEN">
      <svg className="auth-hose" viewBox="0 0 300 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="auth-hose-line" pathLength={1} d={HOSE} />
        <path className="auth-hose-shine" pathLength={1} d={HOSE} />
      </svg>

      <div className="auth-brand-top">
        <p className="auth-wordmark">SIVEN</p>
        <p className="auth-expansion">Sistema de Inventario y Ventas</p>
        <p className="auth-pitch">Toda la operación de NORCOR en un mismo lugar, con permisos por rol y registro de cada movimiento.</p>
      </div>

      <ul className="auth-areas">
        {AREAS.map((a) => (
          <li key={a.title}>
            <span className="auth-area-icon">{a.icon}</span>
            <div>
              <strong>{a.title}</strong>
              <span>{a.desc}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="auth-brand-foot">
        <span className="auth-mark" aria-hidden="true">
          N
        </span>
        <span>NORCOR Fueling System</span>
        <span className="auth-version">Versión 1.0</span>
      </div>
    </aside>
  );
}
