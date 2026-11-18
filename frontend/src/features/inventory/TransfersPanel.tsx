/* Traslados entre la bodega y la sucursal (mejora n.° 23). */
import { useState } from 'react';
import { EmptyRow } from '../../components/feedback/Empty';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SkeletonRows } from '../../components/feedback/Skeleton';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { useRemoteData } from '../../hooks/useRemoteData';
import { fmtDateTime, matches, money } from '../../utils/format';
import { TransferDetailModal } from './TransferDetailModal';
import { trasladosApi } from './transfersApi';

const MODULES = ['inventory'] as const;

export function TransfersPanel() {
  const modal = useModal();
  const { data, error, reload } = useRemoteData(trasladosApi.lista, MODULES);
  const [q, setQ] = useState('');
  const rows = (data ?? []).filter((t) => matches(q, t.codigo, t.origen, t.destino, t.nota, t.usuario, ...t.lineas.map((l) => `${l.sku} ${l.nombre}`)));

  return (
    <>
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por TR-…, producto o motivo…" />
      {error && !data ? (
        <ErrorState msg={error} onRetry={reload} />
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Traslado</th>
                <th>Fecha</th>
                <th>Desde → hacia</th>
                <th>Productos</th>
                <th className="num">Unidades</th>
                <th className="num">Valor</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {!data && <SkeletonRows cols={7} />}
              {data && !data.length && <EmptyRow cols={7} msg="Aún no hay traslados. Use «Trasladar» para surtir la sucursal desde la bodega." ic="⇄" />}
              {data && !!data.length && !rows.length && <EmptyRow cols={7} msg="Ningún traslado coincide con la búsqueda" ic="🔍" />}
              {rows.map((t) => (
                <tr key={t.id} className="row-link" onClick={() => modal.open(<TransferDetailModal trasladoId={t.id} />)}>
                  <td className="mono">{t.codigo}</td>
                  <td className="mono">{fmtDateTime(t.fecha)}</td>
                  <td>
                    {t.origen} <span aria-hidden="true">→</span> {t.destino}
                    {t.nota && <div className="sub-num">{t.nota}</div>}
                  </td>
                  <td>
                    {t.lineas
                      .slice(0, 3)
                      .map((l) => l.sku)
                      .join(', ')}
                    {t.lineas.length > 3 && ` y ${t.lineas.length - 3} más`}
                  </td>
                  <td className="num">{t.unidades}</td>
                  <td className="num">{money(t.valor)}</td>
                  <td>{t.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
