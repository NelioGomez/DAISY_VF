/* Detalle de una cotización con su origen y su destino (trazabilidad SOL › COT › FAC)
   y la antigüedad del estado actual ("Pendiente, hace 8 días"; mejoras n.° 15 y 50). */
import { useCallback, useEffect, useState } from 'react';
import { DocChain, type ChainItem } from '../../components/common/DocChain';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { Cotizacion } from '../../types';
import { ago, fmtDate, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { SaleFormModal } from '../sales/SaleFormModal';
import { RejectQuotationModal } from './RejectQuotationModal';

export function QuotationDetailModal({ cotizacionId }: { cotizacionId: string }) {
  const { obtenerCotizacion, cambiarEstadoCotizacion } = useData();
  const { can } = useAuth();
  const canWrite = can('quotations:write');
  const toast = useToast();
  const modal = useModal();
  const doc = useOpenDocument();
  const [q, setQ] = useState<Cotizacion | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void obtenerCotizacion(cotizacionId).then((r) => {
      if (!alive) return;
      if (r.ok) setQ(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [cotizacionId, obtenerCotizacion, version]);

  const transition = async (accion: 'submit' | 'approve') => {
    if (!q) return;
    setBusy(true);
    const r = await cambiarEstadoCotizacion(q.id, accion);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${q.codigo} ${accion === 'approve' ? 'aprobada' : 'enviada'}`, 'ok');
    load();
  };

  const chain: ChainItem[] = q
    ? [
        ...(q.solicitud
          ? [{ tipo: 'SOLICITUD' as const, id: q.solicitud.id, codigo: q.solicitud.codigo, onOpen: doc.canOpen({ tipo: 'SOLICITUD' }) ? () => doc.open({ tipo: 'SOLICITUD', ...q.solicitud! }) : undefined }]
          : []),
        { tipo: 'COTIZACION', id: q.id, codigo: q.codigo, actual: true },
        ...(q.facturaId && q.factura
          ? [{ tipo: 'VENTA' as const, id: q.facturaId, codigo: q.factura, onOpen: doc.canOpen({ tipo: 'VENTA' }) ? () => doc.open({ tipo: 'VENTA', id: q.facturaId!, codigo: q.factura! }) : undefined }]
          : []),
      ]
    : [];

  const abierta = q && ['Borrador', 'Pendiente', 'Aprobada'].includes(q.estado);
  const faltantes = (q?.items ?? []).filter((i) => i.disponible !== undefined && i.disponible < i.cant);

  return (
    <Modal
      title={q ? `Cotización ${q.codigo}` : 'Cotización'}
      wide
      footer={
        <>
          {q && canWrite && (q.estado === 'Pendiente' || q.estado === 'Aprobada') && (
            <button className="b b-red" style={{ marginRight: 'auto' }} onClick={() => modal.open(<RejectQuotationModal cotizacion={q} />)}>
              Rechazar
            </button>
          )}
          <CancelButton label="Cerrar" />
          {q && canWrite && q.estado === 'Borrador' && (
            <button className="b b-amber" disabled={busy} onClick={() => transition('submit')}>
              Enviar al cliente
            </button>
          )}
          {q && canWrite && q.estado === 'Pendiente' && (
            <button className="b b-amber" disabled={busy} onClick={() => transition('approve')}>
              Marcar aprobada
            </button>
          )}
          {q && canWrite && can('sales:write') && q.estado === 'Aprobada' && (
            <button className="b b-green" onClick={() => modal.open(<SaleFormModal cotizacion={q} />)}>
              → Convertir en venta
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
      ) : !q ? (
        <ViewLoader text="Cargando cotización…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">{q.cliN}</div>
              <div className="doc-meta">
                Emitida {fmtDate(q.fecha)} por @{q.vendedor} · válida hasta {fmtDate(q.validaHasta)}
              </div>
              <div className="doc-meta">
                {q.estado} {ago(q.estadoDesde)}
                {abierta && q.estado === 'Pendiente' && ' · requiere seguimiento'}
              </div>
            </div>
            <EstadoTag estado={q.estado} />
          </div>

          <DocChain items={chain} />

          {q.estado === 'Rechazada' && q.motivoRechazo && (
            <div className="note note-danger" style={{ marginBottom: 12 }}>
              <span className="ic">✕</span>
              <div>Motivo del rechazo: {q.motivoRechazo}</div>
            </div>
          )}
          {abierta && faltantes.length > 0 && (
            <div className="note note-warn" style={{ marginBottom: 12 }}>
              <span className="ic">⚠️</span>
              <div>
                Stock insuficiente hoy para {faltantes.map((f) => f.sku).join(', ')}. Se valida de nuevo al convertir en venta.
              </div>
            </div>
          )}

          <div className="tablewrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Disponible</th>
                  <th className="num">Precio</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(q.items ?? []).map((i) => {
                  const falta = i.disponible !== undefined && i.disponible < i.cant;
                  return (
                    <tr key={i.prod}>
                      <td>
                        {i.prodN} <span className="mono muted-sm">{i.sku}</span>
                      </td>
                      <td className="num">{i.cant}</td>
                      <td className="num" style={falta ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                        {i.disponible ?? '—'}
                        {falta && ' ▼'}
                      </td>
                      <td className="num">{money(i.precio)}</td>
                      <td className="num">{money(i.sub)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="totbox">
            <div className="r">
              <span>Subtotal</span>
              <span>{money(q.sub)}</span>
            </div>
            {q.iva > 0 && (
              <div className="r">
                <span>IVA</span>
                <span>{money(q.iva)}</span>
              </div>
            )}
            <div className="r grand">
              <span>Total</span>
              <span>{money(q.total)}</span>
            </div>
          </div>
          {q.notas && (
            <p className="doc-meta" style={{ marginTop: 10 }}>
              <b>Notas para el cliente:</b> {q.notas}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
