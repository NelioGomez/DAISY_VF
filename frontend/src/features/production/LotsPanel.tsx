/* Lotes de producción y su estado de calidad: por inspeccionar, en retrabajo, liberado o desechado. */
import { useState } from 'react';
import { EmptyRow } from '../../components/feedback/Empty';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth } from '../../store/hooks';
import { fmtDateTime, matches, money } from '../../utils/format';
import { InspectLotModal } from './InspectLotModal';
import { LotDetailModal } from './LotDetailModal';
import { produccionApi, useProduccion, type EstadoLote, type Lote } from './productionApi';

const FILTROS: Array<EstadoLote | 'Todos' | 'Pendientes'> = ['Todos', 'Pendientes', 'Por inspeccionar', 'En retrabajo', 'Liberado', 'Desechado'];

export function LotsPanel() {
  const { can } = useAuth();
  const modal = useModal();
  const { data, error } = useProduccion(produccionApi.lotes);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<(typeof FILTROS)[number]>('Todos');

  if (error)
    return (
      <div className="note note-danger" role="alert">
        <span className="ic">⚠️</span>
        <div>{error}</div>
      </div>
    );
  if (!data) return <ViewLoader text="Cargando lotes…" />;

  const pendiente = (l: Lote) => l.pendiente > 0 || l.retrabajo > 0;
  const rows = data.filter(
    (l) =>
      (estado === 'Todos' || (estado === 'Pendientes' ? pendiente(l) : l.estado === estado)) &&
      matches(q, l.codigo, l.orden?.codigo, l.producto?.nombre, l.producto?.sku, l.estado),
  );
  const abrir = (l: Lote) => modal.open(<LotDetailModal loteId={l.id} />);
  const inspeccionar = (l: Lote) => modal.open(<InspectLotModal loteId={l.id} />);

  return (
    <>
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por lote, OP o producto…">
        <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} aria-label="Estado del lote" className="toolbar-select">
          {FILTROS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </SearchToolbar>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Orden</th>
              <th>Producto</th>
              <th className="num">Producidas</th>
              <th className="num">Liberadas</th>
              <th className="num">Scrap</th>
              <th className="num">Por revisar</th>
              <th>Estado</th>
              <th className="num">Costo u.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!data.length && <EmptyRow cols={10} msg="Aún no hay lotes: se crean al terminar una orden de producción." ic="▦" />}
            {!!data.length && !rows.length && <EmptyRow cols={10} msg="Ningún lote coincide con el filtro" ic="🔍" />}
            {rows.map((l) => (
              <tr key={l.id} className="row-link" onClick={() => abrir(l)}>
                <td className="mono">
                  {l.codigo}
                  <div className="sub-num">{fmtDateTime(l.fecha)}</div>
                </td>
                <td className="mono">{l.orden?.codigo}</td>
                <td>
                  {l.producto?.nombre} <span className="mono muted-sm">{l.producto?.sku}</span>
                </td>
                <td className="num">{l.cantidad}</td>
                <td className="num">{l.liberada}</td>
                <td className="num" style={l.desechada ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                  {l.desechada}
                </td>
                <td className="num" style={pendiente(l) ? { color: 'var(--amber-deep)', fontWeight: 700 } : undefined}>
                  {l.pendiente + l.retrabajo}
                </td>
                <td>
                  <EstadoTag estado={l.estado} />
                </td>
                <td className="num">{money(l.costoUnit)}</td>
                <td>
                  {pendiente(l) && can('quality:write') ? (
                    <button
                      className="b b-amber b-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        inspeccionar(l);
                      }}
                    >
                      Inspeccionar
                    </button>
                  ) : (
                    <button
                      className="b b-out b-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir(l);
                      }}
                    >
                      Ver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
