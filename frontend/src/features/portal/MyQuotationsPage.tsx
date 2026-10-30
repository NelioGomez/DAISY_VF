/* Mis cotizaciones: las que el vendedor ya envió (los borradores no se muestran). */
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import * as portal from '../../services/portal/portalService';
import { fmtDate, money } from '../../utils/format';
import { PortalState } from './PortalStatus';
import { usePortalData } from './usePortalData';

export function MyQuotationsPage() {
  usePageTitle('Mis cotizaciones');
  const { data, error, loading, reload } = usePortalData('cotizaciones', portal.misCotizaciones);

  return (
    <>
      <div className="pub-portal-title">
        <h2>Mis cotizaciones</h2>
      </div>

      {loading ? (
        <p className="pub-muted" aria-busy="true">
          Cargando sus cotizaciones…
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
          <h3>Aún no tiene cotizaciones</h3>
          <p>Cuando un vendedor responda a una de sus solicitudes, la cotización aparecerá aquí con su detalle y vigencia.</p>
          <Link to="/clientes/cuenta/solicitudes" className="pub-btn pub-btn-line">
            Ver mis solicitudes
          </Link>
        </div>
      ) : (
        <div className="pub-tablewrap">
          <table className="pub-table">
            <thead>
              <tr>
                <th scope="col">Cotización</th>
                <th scope="col">Emitida</th>
                <th scope="col">Válida hasta</th>
                <th scope="col">Estado</th>
                <th scope="col" className="is-num">
                  Total
                </th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id}>
                  <td data-label="Cotización">
                    <strong>{q.codigo}</strong>
                    {q.solicitud && <span className="pub-note">Solicitud {q.solicitud.codigo}</span>}
                  </td>
                  <td data-label="Emitida">{fmtDate(q.fecha)}</td>
                  <td data-label="Válida hasta">{fmtDate(q.validaHasta)}</td>
                  <td data-label="Estado">
                    <PortalState estado={q.estado} />
                  </td>
                  <td data-label="Total" className="is-num">
                    {money(q.total)}
                  </td>
                  <td>
                    <Link to={`/clientes/cuenta/cotizaciones/${q.id}`} className="pub-btn pub-btn-line is-small">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
