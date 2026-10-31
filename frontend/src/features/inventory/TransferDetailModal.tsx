/* Detalle de un traslado TR-…: de dónde a dónde, qué productos y cuántas unidades. */
import { useCallback } from 'react';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useRemoteData } from '../../hooks/useRemoteData';
import { fmtDateTime, money } from '../../utils/format';
import { trasladosApi } from './transfersApi';

const MODULES = ['inventory'] as const;

export function TransferDetailModal({ trasladoId }: { trasladoId: string }) {
  const load = useCallback(() => trasladosApi.detalle(trasladoId), [trasladoId]);
  const { data: t, error, reload } = useRemoteData(load, MODULES);

  return (
    <Modal title={t ? `Traslado ${t.codigo}` : 'Traslado'} wide footer={<CancelButton label="Cerrar" />}>
      {error && !t ? (
        <ErrorState msg={error} onRetry={reload} />
      ) : !t ? (
        <ViewLoader text="Cargando traslado…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                <span className="loc-chip">{t.origen}</span> <span aria-hidden="true">→</span>
                <span className="sr-only">hacia</span> <span className="loc-chip">{t.destino}</span>
              </div>
              <div className="doc-meta">
                {fmtDateTime(t.fecha)} · {t.usuario} · {t.unidades} u. · {money(t.valor)} al costo promedio
              </div>
              {t.nota && <div className="doc-meta">Motivo: {t.nota}</div>}
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Costo prom.</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {t.lineas.map((l) => (
                  <tr key={l.prodId}>
                    <td>
                      {l.nombre} <span className="mono muted-sm">{l.sku}</span>
                    </td>
                    <td className="num">{l.cant}</td>
                    <td className="num">{money(l.costo)}</td>
                    <td className="num">{money(l.costo * l.cant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            <span className="ic">ℹ️</span>
            <div>
              Cada línea generó una <b>salida</b> en {t.origen} y una <b>entrada</b> en {t.destino} con la referencia {t.codigo}. El stock total y el costo promedio no
              cambian.
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
