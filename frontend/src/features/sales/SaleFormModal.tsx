/* Venta nueva o conversión de una cotización aprobada.
   El servidor valida stock, calcula impuestos, descuenta inventario,
   registra el pago inicial y crea la cuenta por cobrar si es a crédito. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { LineEditor } from '../../components/forms/LineEditor';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CartLine, Cotizacion } from '../../types';
import { cartTotals } from '../../utils/documents';
import { money } from '../../utils/format';
import { InvoiceModal } from './InvoiceModal';
import { PaymentTermsFields } from './PaymentTermsFields';
import { buildTerms, initialTerms } from './paymentTerms';

interface SaleFormModalProps {
  /** Si viene, la venta se crea convirtiendo esta cotización (con sus líneas y precios). */
  cotizacion?: Cotizacion;
}

export function SaleFormModal({ cotizacion }: SaleFormModalProps) {
  const { db, confirmarVenta, convertirCotizacion } = useData();
  const toast = useToast();
  const modal = useModal();
  const activos = db.clientes.filter((c) => c.activo);
  const [cliId, setCliId] = useState(activos[0]?.id ?? '');
  const [lines, setLines] = useState<CartLine[]>([{ prod: '', cant: 1 }]);
  const [terms, setTerms] = useState(initialTerms);
  const [saving, setSaving] = useState(false);

  const total = cotizacion ? cotizacion.total : cartTotals(db.productos, lines, db.config.taxRate).total;

  const confirm = async () => {
    if (!cotizacion && !cliId) return toast('Seleccione un cliente', 'err');
    if (!cotizacion && !lines.some((l) => l.prod && l.cant > 0)) return toast('Agregue al menos un producto', 'err');
    const t = buildTerms(terms, total);
    if (typeof t === 'string') return toast(t, 'err');
    setSaving(true);
    const r = cotizacion ? await convertirCotizacion(cotizacion.id, t) : await confirmarVenta(cliId, lines, t);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Venta ${r.data.factura} registrada`, 'ok');
    modal.open(<InvoiceModal ventaId={r.data.ventaId} />);
  };

  return (
    <Modal
      title={cotizacion ? `Convertir ${cotizacion.codigo} en venta` : 'Nueva venta'}
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={confirm} disabled={saving}>
            {saving ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </>
      }
    >
      {cotizacion ? (
        <>
          <div className="card" style={{ background: 'var(--panel)', padding: 12, marginBottom: 14 }}>
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
        </>
      ) : (
        <>
          <Field label="Cliente">
            <select value={cliId} onChange={(e) => setCliId(e.target.value)}>
              {activos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <LineEditor lines={lines} onChange={setLines} />
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <PaymentTermsFields value={terms} onChange={setTerms} total={total} />
      </div>

      <div className="note" style={{ marginTop: 12 }}>
        <span className="ic">⚠️</span>
        <div>Al confirmar, el servidor valida el stock, genera la factura, descuenta el inventario y —si es a crédito— crea la cuenta por cobrar.</div>
      </div>
    </Modal>
  );
}
