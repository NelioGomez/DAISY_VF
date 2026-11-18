/* Sitio público de NORCOR (mejora n.° 35): Inicio, Productos, Nosotros, Contacto
   e Iniciar sesión de clientes. No comparte navegación con el sistema interno;
   el acceso de colaboradores queda solo como enlace discreto en el pie. */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCustomer, useQuoteList } from '../portal/useCustomer';
import { whatsappUrl } from '../../services/public/publicService';
import { CompareTray } from './CompareTray';
import { QuickView } from './QuickView';
import { QuoteListDrawer } from './QuoteListDrawer';
import { usePublicInfo } from './usePublicInfo';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import '../auth/auth.css';
import './public.css';
import { ThemeToggle } from '../../components/common/ThemeToggle';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/catalogo', label: 'Productos', end: false },
  { to: '/nosotros', label: 'Nosotros', end: false },
  { to: '/contacto', label: 'Contacto', end: false },
];

const YEAR = new Date().getFullYear();

export function PublicLayout() {
  const { cuenta } = useCustomer();
  const lista = useQuoteList();
  const { info } = usePublicInfo();
  const location = useLocation();
  const [menu, setMenu] = useState<{ open: boolean; at: string }>({ open: false, at: location.pathname });
  // El menú del celular se cierra solo al cambiar de página.
  const menuOpen = menu.open && menu.at === location.pathname;

  // Animación breve del contador cuando cambia la cantidad de la lista.
  const badge = useRef<HTMLSpanElement>(null);
  const prev = useRef(lista.lineas.length);
  useEffect(() => {
    if (lista.lineas.length > prev.current) {
      badge.current?.animate([{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    }
    prev.current = lista.lineas.length;
  }, [lista.lineas.length]);

  // Al cambiar de página se vuelve arriba (salvo al cambiar solo los filtros del catálogo).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const empresa = info?.empresa;
  const nombreCuenta = cuenta ? cuenta.contacto.split(' ')[0] || cuenta.cliente.nombre : '';

  return (
    <div className="pub">
      <a href="#pub-main" className="pub-skip">
        Saltar al contenido
      </a>
      <header className="pub-head">
        <div className="pub-head-in">
          <Link to="/" className="pub-brand" aria-label="NORCOR Fueling System, inicio">
            <span className="pub-brand-mark" aria-hidden="true">
              N
            </span>
            <span className="pub-brand-name">
              NORCOR
              <small>Fueling System</small>
            </span>
          </Link>

          <nav className={`pub-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Sitio" id="pub-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to={cuenta ? '/clientes/cuenta' : '/clientes/ingresar'} className="pub-nav-account">
              {cuenta ? 'Mi cuenta' : 'Iniciar sesión'}
            </NavLink>
          </nav>

          <div className="pub-head-actions">
            <ThemeToggle className="pub-themebtn" />
            {cuenta ? (
              <Link to="/clientes/cuenta" className="pub-account" title={`${cuenta.cliente.nombre} (${cuenta.email})`}>
                <span className="pub-account-dot" aria-hidden="true">
                  {nombreCuenta.charAt(0).toUpperCase()}
                </span>
                <span className="pub-account-name">{nombreCuenta}</span>
              </Link>
            ) : (
              <Link to="/clientes/ingresar" state={{ from: location.pathname + location.search }} className="pub-account is-guest">
                Iniciar sesión
              </Link>
            )}
            <button type="button" className="pub-listbtn" onClick={() => lista.setAbierta(true)} aria-haspopup="dialog">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 5h11M9 12h11M9 19h11" />
                <path d="M4 5h.01M4 12h.01M4 19h.01" />
              </svg>
              <span>Mi lista</span>
              <span className={`pub-listbtn-count ${lista.lineas.length ? '' : 'is-empty'}`} ref={badge} aria-label={`${lista.lineas.length} productos`}>
                {lista.lineas.length}
              </span>
            </button>
            <button
              type="button"
              className="pub-menubtn"
              aria-expanded={menuOpen}
              aria-controls="pub-nav"
              onClick={() => setMenu({ open: !menuOpen, at: location.pathname })}
            >
              <span className="sr-only">Menú</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="pub-main" className="pub-main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="pub-foot">
        <div className="pub-foot-in">
          <div className="pub-foot-brand">
            <span className="pub-brand-name">
              NORCOR
              <small>Fueling System</small>
            </span>
            <p>Repuestos, equipos y servicio técnico para estaciones de servicio en Nicaragua.</p>
          </div>
          <nav aria-label="Pie de página">
            <h2>Sitio</h2>
            <Link to="/catalogo">Productos</Link>
            <Link to="/nosotros">Nosotros</Link>
            <Link to="/contacto">Contacto</Link>
          </nav>
          <nav aria-label="Clientes">
            <h2>Clientes</h2>
            {cuenta ? (
              <>
                <Link to="/clientes/cuenta/solicitudes">Mis solicitudes</Link>
                <Link to="/clientes/cuenta/cotizaciones">Mis cotizaciones</Link>
                <Link to="/clientes/cuenta/perfil">Mi perfil</Link>
              </>
            ) : (
              <>
                <Link to="/clientes/ingresar">Iniciar sesión</Link>
                <Link to="/clientes/registro">Crear cuenta</Link>
              </>
            )}
          </nav>
          <div>
            <h2>Contacto</h2>
            <a href={whatsappUrl(empresa, 'Hola NORCOR, necesito información sobre un repuesto.')} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            {empresa?.telefono && <a href={`tel:${empresa.telefono.replace(/[^\d+]/g, '')}`}>{empresa.telefono}</a>}
            {empresa?.correo && <a href={`mailto:${empresa.correo}`}>{empresa.correo}</a>}
            {empresa?.horario && <span>{empresa.horario}</span>}
          </div>
        </div>
        <div className="pub-foot-bottom">
          <span>© {YEAR} NORCOR Fueling System</span>
          <Link to="/login" className="pub-staff">
            Acceso de colaboradores
          </Link>
        </div>
      </footer>

      <QuoteListDrawer />
      <QuickView />
      <CompareTray />
    </div>
  );
}
