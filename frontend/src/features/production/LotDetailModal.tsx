/* Detalle de un lote de producción: de qué orden viene, cuántas unidades se liberaron, se
   desecharon o están en retrabajo, y el historial de inspecciones de calidad. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useCallback } from 'react';
import { DocChain } from '../../components/common/DocChain';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth } from '../../store/hooks';
import { fmtDateTime, money } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { InspectLotModal } from './InspectLotModal';
import { OrderDetailModal } from './OrderDetailModal';
import { nombreDisposicion, produccionApi, useProduccion } from './productionApi';

export function LotDetailModal({ loteId }: { loteId: string }) {
  const { can } = useAuth();
  const modal = useModal();
  const load = useCallback(() => produccionApi.lote(loteId), [loteId]);
  const { data: l, error, reload } = useProduccion(load);
  const porInspeccionar = !!l && (l.pendiente > 0 || l.retrabajo > 0);
  const unidad = l?.producto?.unidad ?? 'UNIT';

  return (
    <Modal
      title={l ? `Lote ${l.codigo}` : 'Lote'}
      wide
      footer={
        <>
          <CancelButton label="Cerrar" />
          {l && porInspeccionar && can('quality:write') && (
            <button className="b b-amber" onClick={() => modal.open(<InspectLotModal loteId={l.id} />)}>
              Registrar inspección
            </button>
          )}
        </>
      }
    >
      {error && !l ? (
        <ErrorState msg={error} onRetry={reload} />
      ) : !l ? (
        <ViewLoader text="Cargando lote…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {l.producto?.nombre} <span className="mono muted-sm">{l.producto?.sku}</span>
              </div>
              <div className="doc-meta">
                Producido {fmtDateTime(l.fecha)} · {cantidadCon(l.cantidad, unidad)} · costo de materiales {money(l.costoUnit)} por unidad
              </div>
            </div>
            <EstadoTag estado={l.estado} />
          </div>

          <DocChain
            items={[
              ...(l.orden ? [{ tipo: 'PRODUCCION' as const, id: l.orden.id, codigo: l.orden.codigo, onOpen: () => modal.open(<OrderDetailModal ordenId={l.orden!.id} />) }] : []),
              { tipo: 'LOTE', id: l.id, codigo: l.codigo, actual: true },
              ...(l.liberada > 0 ? [{ tipo: 'MOVIMIENTO' as const, id: 'in', codigo: `+${l.liberada} al inventario` }] : []),
            ]}
          />

          <div className="mini-kpis lot-kpis">
            <div>
              <span>Liberadas</span>
              <b>{l.liberada}</b>
              <small>entraron al inventario</small>
            </div>
            <div>
              <span>Scrap</span>
              <b>{l.desechada}</b>
              <small>desechadas</small>
            </div>
            <div>
              <span>En retrabajo</span>
              <b>{l.retrabajo}</b>
              <small>vuelven a inspección</small>
            </div>
            <div>
              <span>Por inspeccionar</span>
              <b>{l.pendiente}</b>
              <small>sin revisar</small>
            </div>
          </div>

          <h4 className="section-title">Inspecciones de calidad</h4>
          {!l.inspecciones.length ? (
            <p className="doc-meta">Todavía no se inspecciona: las unidades no están disponibles para la venta.</p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Inspección</th>
                    <th>Etapa</th>
                    <th className="num">Inspeccionadas</th>
                    <th className="num">No conformes</th>
                    <th>Resultado</th>
                    <th>Disposición</th>
                    <th>Inspector</th>
                  </tr>
                </thead>
                <tbody>
                  {l.inspecciones.map((i) => (
                    <tr key={i.id} title={i.notas || undefined}>
                      <td className="mono">
                        {i.codigo}
                        <div className="sub-num">{fmtDateTime(i.fecha)}</div>
                      </td>
                      <td>{i.etapa}</td>
                      <td className="num">{i.inspeccionadas}</td>
                      <td className="num">{i.defectuosas}</td>
                      <td>
                        <EstadoTag estado={i.conforme ? 'Conforme' : 'No conforme'} />
                      </td>
                      <td>
                        {i.conforme ? '—' : nombreDisposicion(i.disposicion)}
                        {i.defecto && <div className="sub-num">{i.defecto}</div>}
                      </td>
                      <td>{i.inspector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
