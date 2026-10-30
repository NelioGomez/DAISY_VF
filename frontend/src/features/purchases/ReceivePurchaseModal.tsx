/* Recepción de mercadería (total o parcial). Antes de confirmar muestra qué va a pasar:
   cuántas unidades entran a bodega, cómo queda el stock y el costo promedio de cada producto
   (confirmación contextual, mejora n.° 26). El servidor hace el cálculo definitivo. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Compra } from '../../types';
import { money } from '../../utils/format';
import { PurchaseDetailModal } from './PurchaseDetailModal';
import { nextAverageCost } from './purchaseFormat';

export function ReceivePurchaseModal({ compra }: { compra: Compra }) {
  const { db, recibirCompra } = useData();
  const toast = useToast();
  const modal = useModal();
  const pendientes = (compra.items ?? []).filter((i) => i.pendiente > 0);
  const [cant, setCant] = useState<Record<string, string>>(() => Object.fromEntries(pendientes.map((i) => [i.id, String(i.pendiente)])));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const lines = pendientes.map((i) => {
    const q = Math.round(Number(cant[i.id] || 0));
    const p = db.productos.find((x) => x.id === i.prod);
    const stock = p?.stock ?? i.stockActual;
    const avg = p?.costo ?? 0;
    return { i, q, stock, avg, nuevoStock: stock + q, nuevoCosto: nextAverageCost(stock, avg, q, i.costoBodega), invalida: q < 0 || q > i.pendiente || !Number.isInteger(q) };
  });
  const recibidas = lines.filter((l) => l.q > 0);
  const unidades = recibidas.reduce((n, l) => n + l.q, 0);
  const completa = lines.every((l) => l.q === l.i.pendiente);
  const invalida = lines.some((l) => l.invalida);

  const confirmar = async () => {
    if (invalida) return toast('Cada cantidad debe ser un entero entre 0 y lo pendiente', 'err');
    if (!unidades) return toast('Indique al menos una cantidad recibida', 'err');
    setSaving(true);
    const r = await recibirCompra(
      compra.id,
      recibidas.map((l) => ({ lineaId: l.i.id, cant: l.q })),
      notas,
    );
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Recepción ${r.data.recepcion} registrada · ${unidades} u. ingresaron a bodega`, 'ok');
    modal.open(<PurchaseDetailModal compraId={compra.id} />);
  };

  return (
    <Modal
      title={`Registrar recepción · ${compra.codigo}`}
      wide
      footer={
        <>
          <button className="b b-out" style={{ marginRight: 'auto' }} onClick={() => modal.open(<PurchaseDetailModal compraId={compra.id} />)}>
            ← Volver
          </button>
          <CancelButton />
          <button className="b b-amber" onClick={confirmar} disabled={saving || !unidades || invalida}>
            {saving ? 'Registrando…' : `Confirmar recepción (${unidades} u.)`}
          </button>
        </>
      }
    >
      <p className="doc-meta" style={{ marginBottom: 10 }}>
        {compra.proveedor} · indique lo que llegó físicamente. Lo que no llegue queda pendiente para otra recepción.
      </p>
      <div className="tablewrap" style={{ marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Pendiente</th>
              <th className="num" style={{ width: 110 }}>
                Llega ahora
              </th>
              <th className="num">Costo en bodega</th>
              <th className="num">Stock</th>
              <th className="num">Costo promedio</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ i, q, stock, avg, nuevoStock, nuevoCosto, invalida: bad }) => (
              <tr key={i.id}>
                <td>
                  {i.prodN} <span className="mono muted-sm">{i.sku}</span>
                </td>
                <td className="num">{i.pendiente}</td>
                <td className="num">
                  <input
                    className="cell-input"
                    type="number"
                    min={0}
                    max={i.pendiente}
                    value={cant[i.id] ?? ''}
                    onChange={(e) => setCant((s) => ({ ...s, [i.id]: e.target.value }))}
                    aria-label={`Unidades de ${i.sku} que llegan ahora`}
                    aria-invalid={bad}
                  />
                </td>
                <td className="num">{money(i.costoBodega)}</td>
                <td className="num">{q > 0 ? `${stock} → ${nuevoStock}` : stock}</td>
                <td className="num">{q > 0 && avg !== nuevoCosto ? `${money(avg)} → ${money(nuevoCosto)}` : money(avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label="Notas de la recepción" full>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Factura o guía del proveedor, estado de la mercadería…" />
      </Field>

      <div className={`confirm-box ${unidades ? '' : 'is-empty'}`} role="status" aria-live="polite">
        {unidades ? (
          <>
            <b>
              Ingresarán {unidades} unidad(es) de {recibidas.length} producto(s) a la Bodega principal.
            </b>
            <ul>
              <li>Se registrará una entrada de inventario por producto, enlazada a esta recepción.</li>
              <li>El costo promedio se recalcula con el costo en bodega (incluye flete y gastos, convertido a córdobas).</li>
              <li>La compra quedará {completa ? <b>Recibida</b> : <b>Parcialmente recibida</b>}.</li>
            </ul>
          </>
        ) : (
          <span>Indique cuántas unidades llegaron.</span>
        )}
      </div>
    </Modal>
  );
}
