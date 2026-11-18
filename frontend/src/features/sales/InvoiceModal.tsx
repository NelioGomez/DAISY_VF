/* Factura: se carga el detalle real desde GET /sales/:id. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChain } from '../../components/common/DocChain';
import { Logo } from '../../components/common/Logo';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { Venta } from '../../types';
import { fmtDate, fmtDateTime, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { VoidSaleModal } from './VoidSaleModal';

export function InvoiceModal({ ventaId }: { ventaId: string }) {
  const { obtenerVenta } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const doc = useOpenDocument();
  const navigate = useNavigate();
  const [v, setV] = useState<Venta | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void obtenerVenta(ventaId).then((r) => {
      if (!alive) return;
      if (r.ok) setV(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [ventaId, obtenerVenta]);

  const irAPagos = () => {
    modal.close();
    navigate('/app/pagos');
  };

  return (
    <Modal
      title={v ? 'Factura ' + v.factura : 'Factura'}
      wide
      footer={
        <>
          {v && v.estado !== 'Anulada' && can('sales:void') && (
            <button className="b b-red" style={{ marginRight: 'auto' }} onClick={() => modal.open(<VoidSaleModal venta={v} />)}>
              Anular venta
            </button>
          )}
          <CancelButton label="Cerrar" />
          {v && v.saldo > 0 && v.estado !== 'Anulada' && can('payments:write') && (
            <button className="b b-amber" onClick={irAPagos}>
              Registrar pago
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
      ) : !v ? (
        <ViewLoader text="Cargando factura…" />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Logo variant="invoice" />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                {v.factura}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(v.fecha)}</div>
              <EstadoTag estado={v.estado} />
            </div>
          </div>

          <DocChain
            items={[
              ...(v.solicitud
                ? [{ tipo: 'SOLICITUD' as const, id: v.solicitud.id, codigo: v.solicitud.codigo, onOpen: doc.canOpen({ tipo: 'SOLICITUD' }) ? () => doc.open({ tipo: 'SOLICITUD', ...v.solicitud! }) : undefined }]
                : []),
              ...(v.cotizacionId && v.cotizacion
                ? [{ tipo: 'COTIZACION' as const, id: v.cotizacionId, codigo: v.cotizacion, onOpen: doc.canOpen({ tipo: 'COTIZACION' }) ? () => doc.open({ tipo: 'COTIZACION', id: v.cotizacionId!, codigo: v.cotizacion! }) : undefined }]
                : []),
              { tipo: 'VENTA' as const, id: v.id, codigo: v.factura, actual: true },
              ...(v.pagos?.length ? [{ tipo: 'PAGO' as const, id: 'pagos', codigo: `${v.pagos.length} pago(s)`, detalle: money(v.pagos.reduce((a, p) => a + p.monto, 0)) }] : []),
              ...(v.items?.length ? [{ tipo: 'MOVIMIENTO' as const, id: 'salidas', codigo: `${v.items.length} salida(s) de inventario` }] : []),
            ]}
          />

          {v.estado === 'Anulada' && (
            <div className="note" style={{ marginBottom: 14, background: 'var(--red-soft)', borderColor: '#f5c2bd', color: '#9c241b' }}>
              <span className="ic">⛔</span>
              <div>
                Venta anulada. Motivo: {v.motivoAnulacion || '—'}
              </div>
            </div>
          )}

          <div className="card" style={{ background: 'var(--panel)', padding: 12, marginBottom: 14 }}>
            <b>Cliente:</b> {v.cliN}
            <br />
            <span className="mono" style={{ fontSize: 12 }}>
              RUC: {v.ruc || '—'}
            </span>
          </div>

          <table style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Precio</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(v.items ?? []).map((it, i) => (
                <tr key={it.prod + i}>
                  <td>
                    {it.prodN}
                    <span className="mono" style={{ fontSize: 11, color: 'var(--soft)' }}>
                      {' '}
                      {it.sku}
                    </span>
                  </td>
                  <td className="num">{it.cant}</td>
                  <td className="num">{money(it.precio)}</td>
                  <td className="num">{money(it.sub)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totbox">
            <div className="r">
              <span>Subtotal</span>
              <span>{money(v.sub)}</span>
            </div>
            {v.iva > 0 && (
              <div className="r">
                <span>IVA</span>
                <span>{money(v.iva)}</span>
              </div>
            )}
            <div className="r grand">
              <span>Total</span>
              <span>{money(v.total)}</span>
            </div>
            {v.saldo > 0 && v.estado !== 'Anulada' && (
              <div className="r" style={{ color: 'var(--red)' }}>
                <span>Saldo pendiente</span>
                <span>{money(v.saldo)}</span>
              </div>
            )}
          </div>

          {!!v.pagos?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Pagos</div>
              {v.pagos.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #eef2f5' }}>
                  <span>
                    {fmtDate(p.fecha)} · {p.metodo}
                    {p.ref && <span className="mono" style={{ color: 'var(--soft)' }}> · {p.ref}</span>}
                  </span>
                  <span className="mono">{money(p.monto)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 10 }}>
            Forma de pago: {v.metodo}
            {v.vence && ' · Vence: ' + fmtDate(v.vence)} · Vendedor: @{v.vendedor}
          </div>
        </>
      )}
    </Modal>
  );
}
