/* Mis solicitudes: lo que el cliente pidió, su avance y la cotización que generó. También los
   mensajes de Contacto enviados con la sesión (servicio, cuenta, reclamos…, mejora n.° 59) y la
   orden de servicio con que se atendió un servicio técnico o una garantía (mejora n.° 60). */
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import * as portal from '../../services/portal/portalService';
import type { EstadoOrden, TipoConsulta } from '../../types';
import { fmtDate, money } from '../../utils/format';
import { Availability } from '../public/ProductBits';
import { InquiryProgress, PortalState } from './PortalStatus';
import { useQuoteList } from './useCustomer';
import { usePortalData } from './usePortalData';

const MOTIVO: Record<TipoConsulta, string> = {
  Cotización: 'Pedido de precios',
  'Servicio técnico': 'Servicio técnico o garantía',
  Cuenta: 'Mi cuenta',
  Reclamo: 'Reclamo o sugerencia',
  Otra: 'Consulta',
};

const AVANCE_SERVICIO: Record<EstadoOrden, string> = {
  Registrada: 'registrada',
  Asignada: 'asignada a un técnico',
  'En proceso': 'en proceso',
  Completada: 'trabajo terminado',
  Facturada: 'trabajo terminado',
  Cancelada: 'cancelada',
};

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
                    Enviada el {fmtDate(s.fecha)},{' '}
                    {s.items.length ? `${s.items.length} ${s.items.length === 1 ? 'producto' : 'productos'}` : MOTIVO[s.tipo].toLowerCase()}
                  </p>
                </div>
                <PortalState estado={s.estado === 'Cerrada' && s.tipo !== 'Cotización' ? 'Atendida' : s.estado} />
              </div>
              <InquiryProgress estado={s.estado} cotizacion={s.tipo === 'Cotización'} />
              {!s.items.length && s.mensaje && (
                <p className="pub-req-msg">
                  <strong>Su mensaje:</strong> {s.mensaje}
                </p>
              )}

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
                ) : s.ordenServicio ? (
                  <div>
                    Orden de servicio <strong>{s.ordenServicio.codigo}</strong>: {AVANCE_SERVICIO[s.ordenServicio.estado]}
                    {s.ordenServicio.enGarantia && ' · en garantía, sin costo'}
                    {s.ordenServicio.garantiaHasta && (s.ordenServicio.estado === 'Completada' || s.ordenServicio.estado === 'Facturada')
                      ? `. El trabajo tiene garantía hasta el ${fmtDate(s.ordenServicio.garantiaHasta)}.`
                      : '.'}
                  </div>
                ) : s.estado === 'Cancelada' ? (
                  <div>Esta solicitud se canceló. Si aún necesita los productos, envíe una nueva lista.</div>
                ) : s.estado === 'Cerrada' ? (
                  <div>{s.tipo === 'Cotización' ? 'Solicitud cerrada.' : 'Atendida. Si necesita algo más, escríbanos de nuevo.'}</div>
                ) : s.tipo !== 'Cotización' ? (
                  <div>Recibimos su mensaje. Le responderemos por su correo o teléfono.</div>
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
