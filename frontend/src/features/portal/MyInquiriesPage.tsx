/* Mis solicitudes: lo que el cliente pidió, su avance y la cotización que generó. */
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import * as portal from '../../services/portal/portalService';
import { fmtDate, money } from '../../utils/format';
import { Availability } from '../public/ProductBits';
import { InquiryProgress, PortalState } from './PortalStatus';
import { useQuoteList } from './useCustomer';
import { usePortalData } from './usePortalData';

export function MyInquiriesPage() {
  usePageTitle('Mis solicitudes');
  const lista = useQuoteList();
  const { data, error, loading, reload } = usePortalData('solicitudes', portal.misSolicitudes);

  return (
    <>
      <div className="pub-portal-title">
        <h2>Mis solicitudes</h2>
        {lista.lineas.length > 0 ? (
          <button type="button" className="pub-btn pub-btn-amber" onClick={() => lista.setAbierta(true)}>
            Enviar mi lista ({lista.lineas.length})
          </button>
        ) : (
          <Link to="/catalogo" className="pub-btn pub-btn-line">
            Nueva solicitud
          </Link>
        )}
      </div>

      {loading ? (
        <p className="pub-muted" aria-busy="true">
          Cargando sus solicitudes…
        </p>
      ) : error ? (
        <div className="pub-empty" role="alert">
          <p>{error}</p>
          <button type="button" className="pub-btn pub-btn-line" onClick={reload}>
            Intentar de nuevo
          </button>
        </div>
      ) : !data?.length ? (
        <div className="pub-empty">
          <h3>Todavía no ha enviado solicitudes</h3>
          <p>Agregue productos a su lista desde el catálogo y envíela: aquí verá su avance y la cotización que le preparemos.</p>
          <Link to="/catalogo" className="pub-btn pub-btn-amber">
            Ver productos
          </Link>
        </div>
      ) : (
        <ul className="pub-reqs">
          {data.map((s) => (
            <li key={s.id} className="pub-req">
              <div className="pub-req-head">
                <div>
                  <h3>{s.codigo}</h3>
                  <p className="pub-muted">
                    Enviada el {fmtDate(s.fecha)}, {s.items.length} {s.items.length === 1 ? 'producto' : 'productos'}
                  </p>
                </div>
                <PortalState estado={s.estado} />
              </div>
              <InquiryProgress estado={s.estado} />

              {s.items.length > 0 && (
                <details className="pub-req-items">
                  <summary>Ver productos solicitados</summary>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Cantidad</th>
                        <th scope="col">Disponibilidad hoy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items.map((i) => (
                        <tr key={i.prod}>
                          <td>
                            <Link to={`/catalogo/${i.prod}`}>{i.nombre}</Link>
                            <span className="pub-sku">{i.sku}</span>
                            {i.nota && <span className="pub-note">{i.nota}</span>}
                          </td>
                          <td className="is-num">{i.cant}</td>
                          <td>
                            <Availability value={i.disponibilidad} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {s.mensaje && (
                    <p className="pub-req-msg">
                      <strong>Su mensaje:</strong> {s.mensaje}
                    </p>
                  )}
                </details>
              )}

              <div className="pub-req-foot">
                {s.cotizacion ? (
                  <>
                    <div>
                      Cotización <strong>{s.cotizacion.codigo}</strong> por <strong>{money(s.cotizacion.total)}</strong>, válida hasta {fmtDate(s.cotizacion.validaHasta)}
                    </div>
                    <Link to={`/clientes/cuenta/cotizaciones/${s.cotizacion.id}`} className="pub-btn pub-btn-dark is-small">
                      Ver cotización
                    </Link>
                  </>
                ) : s.enPreparacion ? (
                  <div>Un vendedor está preparando su cotización.</div>
                ) : s.estado === 'Cancelada' ? (
                  <div>Esta solicitud se canceló. Si aún necesita los productos, envíe una nueva lista.</div>
                ) : s.estado === 'Cerrada' ? (
                  <div>Solicitud cerrada.</div>
                ) : (
                  <div>Recibimos su solicitud. Un vendedor la revisará y le enviará la cotización.</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
