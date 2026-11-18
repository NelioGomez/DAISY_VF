/* Detalle de una cotización del cliente: líneas, totales, vigencia, vendedor y origen. */
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import * as portal from '../../services/portal/portalService';
import { whatsappUrl } from '../../services/public/publicService';
import { fmtDate, money } from '../../utils/format';
import { usePublicInfo } from '../public/usePublicInfo';
import { PortalState } from './PortalStatus';
import { usePortalData } from './usePortalData';

export function QuotationDetailPage() {
  const { id = '' } = useParams();
  const { info } = usePublicInfo();
  const { data: q, error, loading, reload } = usePortalData(`cotizacion:${id}`, (token) => portal.miCotizacion(token, id));
  usePageTitle(q ? `Cotización ${q.codigo}` : 'Cotización');

  if (loading)
    return (
      <p className="pub-muted" aria-busy="true">
        Cargando la cotización…
      </p>
    );

  if (error || !q)
    return (
      <div className="pub-empty" role="alert">
        <h2>No se pudo abrir la cotización</h2>
        <p>{error ?? 'La cotización no existe o no pertenece a su cuenta.'}</p>
        <div className="pub-two">
          <button type="button" className="pub-btn pub-btn-line" onClick={reload}>
            Intentar de nuevo
          </button>
          <Link to="/clientes/cuenta/cotizaciones" className="pub-btn pub-btn-line">
            Volver a mis cotizaciones
          </Link>
        </div>
      </div>
    );

  const vigente = q.estado === 'Pendiente' || q.estado === 'Aprobada';

  return (
    <article className="pub-quote">
      <nav className="pub-crumbs" aria-label="Ruta">
        <Link to="/clientes/cuenta/cotizaciones">Mis cotizaciones</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{q.codigo}</span>
      </nav>

      <header className="pub-quote-head">
        <div>
          <h2>Cotización {q.codigo}</h2>
          {info?.empresa && (
            <p className="pub-muted pub-quote-issuer">
              {info.empresa.nombre}
              {info.empresa.ruc && <> · RUC {info.empresa.ruc}</>}
            </p>
          )}
          <p className="pub-muted">
            Emitida el {fmtDate(q.fecha)}. Válida hasta el {fmtDate(q.validaHasta)}.
          </p>
          {q.solicitud && (
            <p className="pub-muted">
              Responde a su solicitud <Link to="/clientes/cuenta/solicitudes">{q.solicitud.codigo}</Link>.
            </p>
          )}
        </div>
        <PortalState estado={q.estado} />
      </header>

      {q.estado === 'Convertida' && (
        <p className="pub-notice is-ok">Esta cotización ya se facturó{q.factura ? ` (factura ${q.factura})` : ''}.</p>
      )}
      {q.estado === 'Vencida' && <p className="pub-notice is-warn">Esta cotización venció. Envíe una nueva lista para recibir precios actualizados.</p>}
      {q.estado === 'Rechazada' && <p className="pub-notice is-warn">Esta cotización se marcó como rechazada.</p>}

      <div className="pub-tablewrap">
        <table className="pub-table is-lines">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col" className="is-num">
                Cantidad
              </th>
              <th scope="col" className="is-num">
                Precio unitario
              </th>
              <th scope="col" className="is-num">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {(q.items ?? []).map((i, n) => (
              <tr key={`${i.sku}-${n}`}>
                <td data-label="Producto">
                  {i.nombre}
                  <span className="pub-sku">{i.sku}</span>
                </td>
                <td data-label="Cantidad" className="is-num">
                  {i.cant}
                </td>
                <td data-label="Precio unitario" className="is-num">
                  {money(i.precio)}
                </td>
                <td data-label="Subtotal" className="is-num">
                  {money(i.sub)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="pub-totals">
        {q.iva > 0 && (
          <>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(q.sub)}</dd>
            </div>
            <div>
              <dt>IVA</dt>
              <dd>{money(q.iva)}</dd>
            </div>
          </>
        )}
        <div className="is-total">
          <dt>Total</dt>
          <dd>{money(q.total)}</dd>
        </div>
      </dl>

      {q.notas && (
        <section className="pub-quote-notes">
          <h3>Observaciones del vendedor</h3>
          <p>{q.notas}</p>
        </section>
      )}

      <footer className="pub-quote-foot">
        <div>
          <span className="pub-muted">Le atiende</span>
          <strong>{q.vendedor.nombre || 'Equipo de ventas NORCOR'}</strong>
          {q.vendedor.correo && <a href={`mailto:${q.vendedor.correo}?subject=${encodeURIComponent(`Cotización ${q.codigo}`)}`}>{q.vendedor.correo}</a>}
        </div>
        <div className="pub-quote-actions">
          {vigente && (
            <a
              className="pub-btn pub-btn-amber"
              href={whatsappUrl(info?.empresa, `Hola NORCOR, quiero confirmar la cotización ${q.codigo} por ${money(q.total)}.`)}
              target="_blank"
              rel="noreferrer"
            >
              Confirmar por WhatsApp
            </a>
          )}
          <button type="button" className="pub-btn pub-btn-line" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </footer>
    </article>
  );
}
