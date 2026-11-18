/* Conversión de una cotización aprobada en venta (las ventas nuevas se hacen en la pantalla POS).
   Dos pasos: condiciones de pago → resumen con advertencias de stock → confirmar (mejora n.° 26).
   El servidor valida stock, calcula impuestos, descuenta inventario y registra el pago inicial. */
import { useState } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CondicionesPago } from '../../store/storeContext';
import type { Cotizacion } from '../../types';
import { money } from '../../utils/format';
import { InvoiceModal } from './InvoiceModal';
import { PaymentTermsFields } from './PaymentTermsFields';
import { buildTerms, initialTerms } from './paymentTerms';
import { SaleSummary } from './SaleSummary';
import { stockWarnings, type SummaryLine } from './stockWarnings';

export function SaleFormModal({ cotizacion }: { cotizacion: Cotizacion }) {
  const { convertirCotizacion } = useData();
  const toast = useToast();
  const modal = useModal();
  const [terms, setTerms] = useState(initialTerms);
  const [resumen, setResumen] = useState<CondicionesPago | null>(null);
  const [saving, setSaving] = useState(false);

  const lines: SummaryLine[] = (cotizacion.items ?? []).map((i) => ({
    prod: i.prod,
    nombre: i.prodN,
    sku: i.sku ?? '',
    cant: i.cant,
    precio: i.precio,
    sub: i.sub,
    stock: i.disponible,
    min: i.minimo,
  }));
  const totals = { sub: cotizacion.sub, iva: cotizacion.iva, total: cotizacion.total };
  const bloqueada = stockWarnings(lines).some((w) => w.tipo === 'falta');

  const revisar = () => {
    const t = buildTerms(terms, cotizacion.total);
    if (typeof t === 'string') return toast(t, 'err');
    setResumen(t);
  };

  const confirmar = async () => {
    if (!resumen) return;
    setSaving(true);
    const r = await convertirCotizacion(cotizacion.id, resumen);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Venta ${r.data.factura} registrada desde ${cotizacion.codigo}`, 'ok');
    modal.open(<InvoiceModal ventaId={r.data.ventaId} />);
  };

  return (
    <Modal
      title={`Convertir ${cotizacion.codigo} en venta`}
      wide
      footer={
        resumen ? (
          <>
            <button className="b b-out" onClick={() => setResumen(null)}>
              ← Cambiar forma de pago
            </button>
            <button className="b b-amber" onClick={confirmar} disabled={saving || bloqueada}>
              {saving ? 'Registrando…' : 'Confirmar venta'}
            </button>
          </>
        ) : (
          <>
            <CancelButton />
            <button className="b b-amber" onClick={revisar} disabled={bloqueada}>
              Revisar y confirmar · {money(cotizacion.total)}
            </button>
          </>
        )
      }
    >
      {resumen ? (
        <SaleSummary cliente={cotizacion.cliN} lines={lines} totals={totals} terms={resumen} />
      ) : (
        <>
          <div className="card soft-card" style={{ marginBottom: 14 }}>
            <b>Cliente:</b> {cotizacion.cliN}
          </div>
          <table style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
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
              {(cotizacion.items ?? []).map((it) => {
                const falta = it.disponible !== undefined && it.disponible < it.cant;
                return (
                  <tr key={it.prod}>
                    <td>{it.prodN}</td>
                    <td className="num">{it.cant}</td>
                    <td className="num" style={falta ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                      {it.disponible ?? '—'}
                      {falta && ' ▼'}
                    </td>
                    <td className="num">{money(it.precio)}</td>
                    <td className="num">{money(it.sub)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="totbox">
            <div className="r">
              <span>Subtotal</span>
              <span>{money(cotizacion.sub)}</span>
            </div>
            {cotizacion.iva > 0 && (
              <div className="r">
                <span>IVA</span>
                <span>{money(cotizacion.iva)}</span>
              </div>
            )}
            <div className="r grand">
              <span>Total</span>
              <span>{money(cotizacion.total)}</span>
            </div>
          </div>
          {bloqueada && (
            <div className="note note-danger" style={{ marginTop: 12 }} role="alert">
              <span className="ic">✕</span>
              <div>No hay existencia suficiente para facturar toda la cotización. Registre la entrada o ajuste la cotización.</div>
            </div>
          )}
          <h4 className="section-title">Forma de pago</h4>
          <PaymentTermsFields value={terms} onChange={setTerms} total={cotizacion.total} />
        </>
      )}
    </Modal>
  );
}
