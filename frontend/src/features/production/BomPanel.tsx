/* Listas de materiales (BOM): de qué se compone cada producto terminado y su costo estándar.
   Una sola versión vigente por producto; las anteriores quedan como historial. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useState } from 'react';
import { EmptyRow } from '../../components/feedback/Empty';
import { SkeletonTable } from '../../components/feedback/Skeleton';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth } from '../../store/hooks';
import { matches, money } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { BomFormModal } from './BomFormModal';
import { produccionApi, useProduccion } from './productionApi';

export function BomPanel() {
  const { can } = useAuth();
  const canWrite = can('production:write');
  const modal = useModal();
  const { data, error, reload } = useProduccion(produccionApi.boms);
  const [q, setQ] = useState('');
  const [historial, setHistorial] = useState(false);

  if (error && !data) return <ErrorState msg={error} onRetry={reload} />;
  if (!data) return <SkeletonTable cols={7} />;

  const rows = data.filter(
    (b) => (historial || b.vigente) && matches(q, b.codigo, b.producto.nombre, b.producto.sku, ...b.items.map((i) => `${i.componente.sku} ${i.componente.nombre}`)),
  );

  return (
    <>
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por producto o componente…">
        <label className="check-inline">
          <input type="checkbox" checked={historial} onChange={(e) => setHistorial(e.target.checked)} /> Ver versiones anteriores
        </label>
        {canWrite && (
          <button className="b b-out" onClick={() => modal.open(<BomFormModal />)}>
            + Nueva lista de materiales
          </button>
        )}
      </SearchToolbar>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto terminado</th>
              <th>Componentes por unidad</th>
              <th className="num">Costo materiales / u.</th>
              <th>Estado</th>
              <th className="num">Órdenes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!data.length && <EmptyRow cols={7} msg="Aún no hay listas de materiales. Registre de qué se compone cada producto que se ensambla." ic="▤" />}
            {!!data.length && !rows.length && <EmptyRow cols={7} msg="Ninguna lista coincide con el filtro" ic="🔍" />}
            {rows.map((b) => (
              <tr key={b.id} className="row-link" onClick={() => modal.open(<BomFormModal bom={b} />)}>
                <td className="mono">
                  {b.codigo}
                  <div className="sub-num">versión {b.version}</div>
                </td>
                <td>
                  {b.producto.nombre} <span className="mono muted-sm">{b.producto.sku}</span>
                </td>
                <td>
                  <ul className="bom-items">
                    {b.items.map((i) => (
                      <li key={i.id}>
                        <b>{cantidadCon(i.cantidad, i.componente.unidad)}</b> {i.componente.nombre} <span className="mono muted-sm">{i.componente.sku}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="num">{money(b.costoUnitario)}</td>
                <td>
                  <EstadoTag estado={b.vigente ? 'Vigente' : 'Inactiva'} />
                </td>
                <td className="num">{b.ordenes}</td>
                <td>
                  <button
                    className="b b-out b-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      modal.open(<BomFormModal bom={b} />);
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
