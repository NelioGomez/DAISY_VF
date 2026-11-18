import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { LineEditor } from '../../components/forms/LineEditor';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CartLine, MetodoPago } from '../../types';
import { InvoiceModal } from './InvoiceModal';

interface SaleFormModalProps {
  title?: string;
  initialCliId?: string;
  initialLines?: CartLine[];
  /** Cotización de origen cuando la venta viene de una conversión. */
  cotId?: string;
}

const METODOS: MetodoPago[] = ['Contado', 'Transferencia', 'Crédito'];

export function SaleFormModal({ title = 'Nueva venta', initialCliId, initialLines, cotId }: SaleFormModalProps) {
  const { db, confirmarVenta } = useData();
  const toast = useToast();
  const modal = useModal();
  const [cliId, setCliId] = useState(initialCliId ?? db.clientes[0]?.id ?? '');
  const [metodo, setMetodo] = useState<MetodoPago>('Contado');
  const [lines, setLines] = useState<CartLine[]>(initialLines ?? [{ prod: '', cant: 1 }]);

  const confirm = () => {
    const r = confirmarVenta(cliId, metodo, lines, cotId ?? null);
    if (!r.ok) return toast(r.error, 'err');
    toast('Venta ' + r.data.factura + ' registrada', 'ok');
    modal.open(<InvoiceModal ventaId={r.data.ventaId} />);
  };

  return (
    <Modal
      title={title}
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={confirm}>
            Confirmar venta
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Cliente">
          <select value={cliId} onChange={(e) => setCliId(e.target.value)}>
            {db.clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método de pago">
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <LineEditor lines={lines} onChange={setLines} />
      <div className="note" style={{ marginTop: 12 }}>
        <span className="ic">⚠️</span>
        <div>Al confirmar: se valida stock, se genera factura, se descuenta inventario y —si es crédito— se crea la cuenta por cobrar.</div>
      </div>
    </Modal>
  );
}
