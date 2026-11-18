/* Estructura común de las pantallas de acceso (login y recuperación). */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SESSION_IDLE_MINUTES } from '../../config/security';
import { BrandPanel } from './BrandPanel';
import { ShieldIcon } from './icons';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import './auth.css';

const YEAR = new Date().getFullYear();

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <BrandPanel />
      <main className="auth-main">
        <div className="auth-top">
          <span className="auth-top-brand" aria-hidden="true">
            SIVEN
          </span>
          <Link to="/catalogo" className="auth-link">
            Ver catálogo de productos
          </Link>
        </div>

        <div className="auth-panel">{children}</div>

        <footer className="auth-foot">
          <span>
            <ShieldIcon />
            La sesión se cierra tras {SESSION_IDLE_MINUTES} minutos sin actividad.
          </span>
          <span>© {YEAR} NORCOR Fueling System</span>
        </footer>
      </main>
    </div>
  );
}
