/* Rutas de producción: operaciones en orden, centro de trabajo y tiempo estándar por unidad. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useState } from 'react';
import { EmptyRow } from '../../components/feedback/Empty';
import { SkeletonTable } from '../../components/feedback/Skeleton';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth } from '../../store/hooks';
import { matches } from '../../utils/format';
import { produccionApi, useProduccion } from './productionApi';
import { fmtMinutos } from './productionFormat';
import { RouteFormModal } from './RouteFormModal';

export function RoutesPanel() {
  const { can } = useAuth();
  const canWrite = can('production:write');
  const modal = useModal();
  const { data, error, reload } = useProduccion(produccionApi.rutas);
  const [q, setQ] = useState('');

  if (error && !data) return <ErrorState msg={error} onRetry={reload} />;
  if (!data) return <SkeletonTable cols={7} />;

  const rows = data.filter((r) => matches(q, r.codigo, r.nombre, r.producto.nombre, r.producto.sku, ...r.operaciones.map((o) => `${o.nombre} ${o.centro}`)));

  return (
    <>
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por producto, ruta u operación…">
        {canWrite && (
          <button className="b b-out" onClick={() => modal.open(<RouteFormModal />)}>
            + Nueva ruta
          </button>
        )}
      </SearchToolbar>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Operaciones</th>
              <th className="num">Tiempo estándar / u.</th>
              <th>Estado</th>
              <th className="num">Órdenes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!data.length && <EmptyRow cols={7} msg="Aún no hay rutas. Defina los pasos con que se fabrica cada producto." ic="⇢" />}
            {!!data.length && !rows.length && <EmptyRow cols={7} msg="Ninguna ruta coincide con la búsqueda" ic="🔍" />}
            {rows.map((r) => (
              <tr key={r.id} className="row-link" onClick={() => modal.open(<RouteFormModal ruta={r} />)}>
                <td className="mono">{r.codigo}</td>
                <td>
                  {r.producto.nombre} <span className="mono muted-sm">{r.producto.sku}</span>
                  <div className="sub-num">{r.nombre}</div>
                </td>
                <td>
                  <ol className="route-ops">
                    {r.operaciones.map((o) => (
                      <li key={o.id}>
                        <span className="mono">{o.secuencia}</span> {o.nombre}
                        <small>
                          {o.centro && `${o.centro} · `}
                          {o.minutos} min
                        </small>
                      </li>
                    ))}
                  </ol>
                </td>
                <td className="num">{fmtMinutos(r.minutosPorUnidad)}</td>
                <td>
                  <EstadoTag estado={r.vigente ? 'Vigente' : 'Inactiva'} />
                </td>
                <td className="num">{r.ordenes}</td>
                <td>
                  <button
                    className="b b-out b-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      modal.open(<RouteFormModal ruta={r} />);
                    }}
                  >
                    {canWrite ? 'Editar' : 'Ver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
