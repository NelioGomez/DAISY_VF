/* Órdenes de producción: avance por pasos de la ruta y resultado de calidad de sus lotes. */
import { useState } from 'react';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth } from '../../store/hooks';
import { fmtDate, isOverdue, matches } from '../../utils/format';
import { nombreUnidad } from '../../utils/units';
import { OrderDetailModal } from './OrderDetailModal';
import { produccionApi, useProduccion, type EstadoOP, type OrdenFila } from './productionApi';

const FILTROS: Array<EstadoOP | 'Todas' | 'Abiertas'> = ['Abiertas', 'Todas', 'Borrador', 'Liberada', 'En proceso', 'Terminada', 'Cancelada'];
const ABIERTAS: EstadoOP[] = ['Borrador', 'Liberada', 'En proceso'];

export function OrdersPanel() {
  const { can } = useAuth();
  const modal = useModal();
  const { data, error } = useProduccion(produccionApi.ordenes);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<(typeof FILTROS)[number]>('Todas');

  if (error)
    return (
      <div className="note note-danger" role="alert">
        <span className="ic">⚠️</span>
        <div>{error}</div>
      </div>
    );
  if (!data) return <ViewLoader text="Cargando órdenes…" />;

  const rows = data.filter(
    (o) =>
      (estado === 'Todas' || (estado === 'Abiertas' ? ABIERTAS.includes(o.estado) : o.estado === estado)) &&
      matches(q, o.codigo, o.producto.nombre, o.producto.sku, o.estado, ...o.lotes.map((l) => l.codigo)),
  );
  const abrir = (o: OrdenFila) => modal.open(<OrderDetailModal ordenId={o.id} />);
  const atrasada = (o: OrdenFila) => ABIERTAS.includes(o.estado) && isOverdue(o.entrega);

  return (
    <>
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por OP, lote o producto…">
        <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} aria-label="Estado de la orden" className="toolbar-select">
          {FILTROS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </SearchToolbar>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th>Avance de la ruta</th>
              <th>Estado</th>
              <th>Calidad</th>
              <th>Entrega</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!data.length && (
              <EmptyRow
                cols={8}
                msg={can('production:write') ? 'Aún no hay órdenes de producción. Use «Nueva orden de producción».' : 'Aún no hay órdenes de producción.'}
                ic="⚙"
              />
            )}
            {!!data.length && !rows.length && <EmptyRow cols={8} msg="Ninguna orden coincide con el filtro" ic="🔍" />}
            {rows.map((o) => {
              const avance = o.pasosTotal ? Math.round((o.pasosHechos / o.pasosTotal) * 100) : 0;
              return (
                <tr key={o.id} className="row-link" onClick={() => abrir(o)}>
                  <td className="mono">{o.codigo}</td>
                  <td>
                    {o.producto.nombre} <span className="mono muted-sm">{o.producto.sku}</span>
                  </td>
                  <td className="num">
                    {o.estado === 'Terminada' ? `${o.producida} / ${o.cantidad}` : o.cantidad}
                    <div className="sub-num">{nombreUnidad(o.estado === 'Terminada' ? o.producida : o.cantidad, o.producto.unidad)}</div>
                  </td>
                  <td style={{ minWidth: 130 }}>
                    {o.pasosTotal ? (
                      <>
                        <div className="progress" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance ${avance}%`}>
                          <span style={{ width: `${avance}%` }} />
                        </div>
                        <span className="progress-txt">
                          {o.pasosHechos} / {o.pasosTotal} pasos
                        </span>
                      </>
                    ) : (
                      <span className="muted-sm">sin ruta</span>
                    )}
                  </td>
                  <td>
                    <EstadoTag estado={o.estado} />
                  </td>
                  <td>
                    {o.lotes.length ? (
                      <span className="chips" style={{ margin: 0 }}>
                        {o.lotes.map((l) => (
                          <Tag key={l.id} tone={l.estado === 'Liberado' ? 't-green' : l.estado === 'Desechado' ? 't-red' : 't-amber'}>
                            {l.codigo}
                          </Tag>
                        ))}
                        {(o.liberada > 0 || o.desechada > 0) && (
                          <span className="muted-sm">
                            {o.liberada} ok{o.desechada ? ` · ${o.desechada} scrap` : ''}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="muted-sm">—</span>
                    )}
                  </td>
                  <td className="mono" style={atrasada(o) ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                    {fmtDate(o.entrega)}
                    {atrasada(o) && ' ⚠'}
                  </td>
                  <td>
                    <button
                      className="b b-out b-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir(o);
                      }}
                    >
                      {accion(o, can)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** El botón de la fila dice qué sigue para esa orden. */
function accion(o: OrdenFila, can: (p: string) => boolean): string {
  if (!can('production:write')) return 'Ver';
  if (o.estado === 'Borrador') return 'Liberar';
  if (o.estado === 'Liberada') return 'Iniciar';
  if (o.estado === 'En proceso') return o.pasosHechos < o.pasosTotal ? 'Registrar paso' : 'Terminar';
  if (o.estado === 'Terminada' && o.lotes.some((l) => l.estado === 'Por inspeccionar' || l.estado === 'En retrabajo') && can('quality:write')) return 'Inspeccionar';
  return 'Ver';
}
