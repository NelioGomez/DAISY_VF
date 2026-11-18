/* Detalle de una compra: líneas, lo recibido, recepciones y las entradas que generaron.
   Desde aquí se ordena, se recibe o se cancela (según estado y permisos). */
import { useCallback, useEffect, useState } from 'react';
import { DocChain } from '../../components/common/DocChain';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import type { Compra } from '../../types';
import { fmtDate, fmtDateTime, money } from '../../utils/format';
import { CancelPurchaseModal } from './CancelPurchaseModal';
import { PurchaseFormModal } from './PurchaseFormModal';
import { costIn, moneyIn } from './purchaseFormat';
import { ReceivePurchaseModal } from './ReceivePurchaseModal';

export function PurchaseDetailModal({ compraId }: { compraId: string }) {
  const { obtenerCompra, ordenarCompra, eliminarCompra } = useData();
  const { can } = useAuth();
  const canWrite = can('purchases:write');
  const canReceive = canWrite && can('inventory:write');
  const toast = useToast();
  const modal = useModal();
  const [c, setC] = useState<Compra | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const r = await obtenerCompra(compraId);
    if (r.ok) setC(r.data);
    else setError(r.error);
  }, [compraId, obtenerCompra]);

  useEffect(() => {
    void load();
    // Si otra persona recibe o cancela esta compra mientras está abierta, se actualiza sola.
    return subscribeRealtime((e) => {
      if (e.module === 'purchases' && (!e.entityId || e.entityId === compraId)) void load();
    });
  }, [load, compraId]);

  const ordenar = async () => {
    if (!c) return;
    setBusy(true);
    const r = await ordenarCompra(c.id);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c.codigo} ordenada: queda pendiente de recibir`, 'ok');
    void load();
  };

  const eliminar = async () => {
    if (!c) return;
    setBusy(true);
    const r = await eliminarCompra(c.id);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Borrador ${c.codigo} eliminado`, 'ok');
    modal.close();
  };

  const pendiente = c?.estado === 'Ordenada' || c?.estado === 'Parcial';

  return (
    <Modal
      title={c ? `Compra ${c.codigo}` : 'Compra'}
      wide
      footer={
        <>
          {c?.estado === 'Borrador' && canWrite && (
            <button className="b b-red" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => (confirmDelete ? eliminar() : setConfirmDelete(true))}>
              {confirmDelete ? '¿Eliminar el borrador? Confirmar' : 'Eliminar borrador'}
            </button>
          )}
          {c && pendiente && canWrite && (
            <button className="b b-red" style={{ marginRight: 'auto' }} onClick={() => modal.open(<CancelPurchaseModal compra={c} />)}>
              {c.estado === 'Parcial' ? 'Cancelar lo pendiente' : 'Cancelar compra'}
            </button>
          )}
          <CancelButton label="Cerrar" />
          {c?.estado === 'Borrador' && canWrite && (
            <>
              <button className="b b-out" onClick={() => modal.open(<PurchaseFormModal compra={c} />)}>
                Editar
              </button>
              <button className="b b-amber" disabled={busy} onClick={ordenar}>
                {busy ? 'Ordenando…' : 'Ordenar compra'}
              </button>
            </>
          )}
          {c && pendiente && canReceive && (
            <button className="b b-amber" onClick={() => modal.open(<ReceivePurchaseModal compra={c} />)}>
              ↧ Registrar recepción
            </button>
          )}
        </>
      }
    >
      {error ? (
        <div className="note" role="alert">
          <span className="ic">⚠️</span>
          <div>{error}</div>
        </div>
      ) : !c ? (
        <ViewLoader text="Cargando compra…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {c.proveedor} {c.internacional && <Tag tone="t-blue">Internacional</Tag>}
              </div>
              <div className="doc-meta">
                Creada {fmtDateTime(c.fecha)} por @{c.usuario}
                {c.ordenada && <> · ordenada {fmtDate(c.ordenada)}</>}
                {c.esperada && (
                  <span style={c.atrasada ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                    {' '}
                    · llegada esperada {fmtDate(c.esperada)}
                    {c.atrasada && ' (atrasada)'}
                  </span>
                )}
              </div>
              {c.moneda === 'USD' && <div className="doc-meta">Compra en dólares · tipo de cambio C$ {c.tipoCambio.toLocaleString('es-NI', { maximumFractionDigits: 6 })}</div>}
            </div>
            <EstadoTag estado={c.estado} />
          </div>

          <DocChain
            items={[
              { tipo: 'COMPRA', id: c.id, codigo: c.codigo, actual: true },
              ...(c.detalleRecepciones ?? []).map((r) => ({ tipo: 'RECEPCION' as const, id: r.id, codigo: r.codigo, detalle: `${r.unidades} u.` })),
              ...((c.detalleRecepciones?.length ?? 0) > 0
                ? [{ tipo: 'MOVIMIENTO' as const, id: 'mov', codigo: `${c.detalleRecepciones!.reduce((n, r) => n + r.items.length, 0)} entrada(s) de inventario` }]
                : []),
            ]}
          />

          {c.estado === 'Cancelada' && (
            <div className="note note-danger" style={{ marginBottom: 12 }}>
              <span className="ic">⛔</span>
              <div>
                Compra cancelada{c.recibidas > 0 ? ' (lo recibido se conserva en inventario)' : ''}. Motivo: {c.motivoCancelacion || '—'}
              </div>
            </div>
          )}

          <div className="tablewrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Pedido</th>
                  <th className="num">Recibido</th>
                  <th className="num">Pendiente</th>
                  <th className="num">Costo unit.</th>
                  <th className="num" title="Costo en córdobas con gastos prorrateados: el que entra al costo promedio">
                    En bodega (C$)
                  </th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(c.items ?? []).map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.prodN} <span className="mono muted-sm">{i.sku}</span>
                    </td>
                    <td className="num">{i.cant}</td>
                    <td className="num">{i.recibido}</td>
                    <td className="num" style={i.pendiente > 0 && c.estado !== 'Cancelada' ? { color: 'var(--amber-deep)', fontWeight: 700 } : undefined}>
                      {i.pendiente}
                    </td>
                    <td className="num">{costIn(i.costo, c.moneda)}</td>
                    <td className="num">{money(i.costoBodega)}</td>
                    <td className="num">{moneyIn(i.sub, c.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totbox">
            <div className="r">
              <span>Subtotal</span>
              <span>{moneyIn(c.sub, c.moneda)}</span>
            </div>
            {c.gastos > 0 && (
              <div className="r">
                <span>Flete y gastos</span>
                <span>{moneyIn(c.gastos, c.moneda)}</span>
              </div>
            )}
            <div className="r grand">
              <span>Total</span>
              <span>{moneyIn(c.total, c.moneda)}</span>
            </div>
            {c.moneda === 'USD' && (
              <div className="r" style={{ color: 'var(--muted)', fontSize: 12 }}>
                <span>En córdobas</span>
                <span>{money(c.totalNio)}</span>
              </div>
            )}
          </div>

          {c.notas && (
            <p className="doc-meta" style={{ marginTop: 10 }}>
              <b>Notas:</b> {c.notas}
            </p>
          )}

          <h4 className="section-title">Recepciones</h4>
          {!c.detalleRecepciones?.length ? (
            <p className="doc-meta">{pendiente ? 'Todavía no se ha recibido mercadería de esta compra.' : 'Sin recepciones.'}</p>
          ) : (
            c.detalleRecepciones.map((r) => (
              <div className="receipt" key={r.id}>
                <div className="receipt-h">
                  <b className="mono">{r.codigo}</b>
                  <span>
                    {fmtDateTime(r.fecha)} · @{r.usuario} · {r.ubicacion} · {r.unidades} u.
                  </span>
                </div>
                {r.notas && <div className="doc-meta">{r.notas}</div>}
                <ul className="receipt-items">
                  {r.items.map((it) => (
                    <li key={it.id}>
                      <span>
                        {it.prodN} <span className="mono muted-sm">{it.sku}</span>
                      </span>
                      <span className="mono">
                        +{it.cant} u. · {money(it.costo)} c/u {it.movimientoId && <Tag tone="t-green">Entrada registrada</Tag>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </>
      )}
    </Modal>
  );
}
