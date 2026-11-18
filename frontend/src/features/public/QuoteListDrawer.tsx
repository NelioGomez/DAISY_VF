/* Lista de solicitud de cotización (mejora n.° 37): el "carrito" B2B del catálogo.
   Sin sesión, la lista se conserva y se pide iniciar sesión o crear cuenta;
   al volver, el panel se abre otra vez con los mismos productos (flujo 6.2). */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../services/api/client';
import * as portal from '../../services/portal/portalService';
import type { SolicitudPortal } from '../../types';
import { money } from '../../utils/format';
import type { CustomerRedirectState } from '../portal/customerContext';
import { useCustomer, useQuoteList } from '../portal/useCustomer';
import { Availability, ProductMedia, Stepper } from './ProductBits';

export function QuoteListDrawer() {
  const lista = useQuoteList();
  const { cuenta, token, salir } = useCustomer();
  const navigate = useNavigate();
  const location = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviada, setEnviada] = useState<SolicitudPortal | null>(null);
  const { abierta, setAbierta } = lista;

  // Foco al abrir, Esc para cerrar y devolver el foco a quien lo abrió.
  useEffect(() => {
    if (!abierta) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('pub-noscroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('pub-noscroll');
      before?.focus?.();
    };
  }, [abierta, setAbierta]);

  if (!abierta) return null;

  const cerrar = () => {
    setAbierta(false);
    setEnviada(null);
    setError('');
  };

  const irA = (path: string) => {
    const state: CustomerRedirectState = { from: location.pathname + location.search, abrirLista: true };
    setAbierta(false);
    navigate(path, { state });
  };

  const enviar = async () => {
    if (!token || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const sol = await portal.enviarLista(token, lista.lineas, mensaje);
      lista.vaciar();
      setMensaje('');
      setEnviada(sol);
    } catch (e) {
      if (portal.isSessionError(e)) {
        salir('expired');
        const state: CustomerRedirectState = { from: location.pathname + location.search, abrirLista: true, vencida: true };
        setAbierta(false);
        navigate('/clientes/ingresar', { state });
        return;
      }
      setError(errorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  const referencia = lista.lineas.reduce((t, l) => t + (l.precio ?? 0) * l.cant, 0);
  const sinPrecio = lista.lineas.some((l) => l.precio === null);

  return (
    <div className="pub-drawer-bg" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pub-drawer" role="dialog" aria-modal="true" aria-labelledby="pub-list-title" tabIndex={-1} ref={panel}>
        <header className="pub-drawer-h">
          <div>
            <h2 id="pub-list-title">Lista de cotización</h2>
            {!enviada && (
              <p>{lista.lineas.length ? `${lista.lineas.length} ${lista.lineas.length === 1 ? 'producto' : 'productos'}, ${lista.unidades} ${lista.unidades === 1 ? 'unidad' : 'unidades'}` : 'Sin productos'}</p>
            )}
          </div>
          <button type="button" className="pub-x" onClick={cerrar} aria-label="Cerrar la lista">
            ×
          </button>
        </header>

        {enviada ? (
          <div className="pub-drawer-b pub-sent" aria-live="polite">
            <div className="pub-sent-code">{enviada.codigo}</div>
            <p className="pub-sent-state">
              <span className="pub-state is-new">
                <span aria-hidden="true">●</span> {enviada.estado}
              </span>
            </p>
            <h3>Solicitud enviada</h3>
            <p>
              Un vendedor revisará precios y disponibilidad y le enviará la cotización. Puede seguir el estado en <strong>Mis solicitudes</strong>.
            </p>
            <div className="pub-sent-actions">
              <button
                type="button"
                className="pub-btn pub-btn-amber"
                onClick={() => {
                  cerrar();
                  navigate('/clientes/cuenta/solicitudes');
                }}
              >
                Ver mis solicitudes
              </button>
              <button type="button" className="pub-btn pub-btn-line" onClick={cerrar}>
                Seguir viendo productos
              </button>
            </div>
          </div>
        ) : lista.lineas.length === 0 ? (
          <div className="pub-drawer-b pub-list-empty">
            <p>Agregue productos desde el catálogo para pedir una cotización de varios artículos a la vez.</p>
            <button
              type="button"
              className="pub-btn pub-btn-amber"
              onClick={() => {
                cerrar();
                if (!location.pathname.startsWith('/catalogo')) navigate('/catalogo');
              }}
            >
              Ver productos
            </button>
          </div>
        ) : (
          <>
            <div className="pub-drawer-b">
              <ul className="pub-lines">
                {lista.lineas.map((l) => (
                  <li key={l.id} className="pub-line">
                    <Link to={`/catalogo/${l.id}`} className="pub-line-media" onClick={cerrar} tabIndex={-1} aria-hidden="true">
                      <ProductMedia p={l} size={28} />
                    </Link>
                    <div className="pub-line-main">
                      <Link to={`/catalogo/${l.id}`} onClick={cerrar} className="pub-line-name">
                        {l.nombre}
                      </Link>
                      <div className="pub-line-meta">
                        <span className="pub-sku">{l.sku}</span>
                        <Availability value={l.disponibilidad} />
                      </div>
                      <label className="pub-line-note">
                        <span className="sr-only">Observación para {l.nombre}</span>
                        <input
                          type="text"
                          maxLength={255}
                          placeholder="Observación (opcional): medida, modelo del surtidor…"
                          value={l.nota}
                          onChange={(e) => lista.cambiar(l.id, { nota: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="pub-line-qty">
                      <Stepper value={l.cant} label={`Cantidad de ${l.nombre}`} onChange={(cant) => lista.cambiar(l.id, { cant })} />
                      {l.precio !== null && <span className="pub-line-price">{money(l.precio * l.cant)}</span>}
                    </div>
                  </li>
                ))}
              </ul>

              <label className="pub-field">
                <span>Mensaje para el vendedor (opcional)</span>
                <textarea rows={3} maxLength={1000} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Plazo de entrega, lugar de entrega, forma de pago…" />
              </label>
            </div>

            <footer className="pub-drawer-f">
              <div className="pub-ref">
                <span>Total de referencia</span>
                <strong>{money(referencia)}</strong>
              </div>
              <p className="pub-ref-note">
                Calculado con los precios publicados{sinPrecio ? ' (sin los productos a consultar)' : ''}. El precio final lo confirma la cotización.
              </p>
              {error && (
                <p className="pub-error" role="alert">
                  {error}
                </p>
              )}
              {cuenta ? (
                <>
                  <p className="pub-as">
                    Se enviará a nombre de <strong>{cuenta.cliente.nombre}</strong> ({cuenta.email}).
                  </p>
                  <button type="button" className="pub-btn pub-btn-amber is-block" onClick={enviar} disabled={enviando} aria-busy={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </>
              ) : (
                <>
                  <p className="pub-as">Para enviar la solicitud inicie sesión o cree su cuenta de cliente. Su lista se conserva.</p>
                  <div className="pub-two">
                    <button type="button" className="pub-btn pub-btn-amber" onClick={() => irA('/clientes/ingresar')}>
                      Iniciar sesión
                    </button>
                    <button type="button" className="pub-btn pub-btn-line" onClick={() => irA('/clientes/registro')}>
                      Crear cuenta
                    </button>
                  </div>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

