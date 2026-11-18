/* Paso de confirmación de la venta tipo POS: muestra el resumen y, al confirmar, registra la venta. */
import { useState } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CondicionesPago } from '../../store/storeContext';
import { InvoiceModal } from './InvoiceModal';
import type { Efectivo } from './paymentTerms';
import { SaleSummary } from './SaleSummary';
import { stockWarnings, type SummaryLine } from './stockWarnings';

interface Props {
  cliId: string;
  cliente: string;
  lines: SummaryLine[];
  totals: { sub: number; iva: number; total: number };
  terms: CondicionesPago;
  efectivo?: Efectivo | null;
  onDone(): void;
}

export function SaleConfirmModal({ cliId, cliente, lines, totals, terms, efectivo, onDone }: Props) {
  const { confirmarVenta } = useData();
  const toast = useToast();
  const modal = useModal();
  const [saving, setSaving] = useState(false);
  const bloqueada = stockWarnings(lines).some((w) => w.tipo === 'falta');

  const confirmar = async () => {
    setSaving(true);
    const r = await confirmarVenta(
      cliId,
      lines.map((l) => ({ prod: l.prod, cant: l.cant })),
      terms,
    );
    setSaving(false);
    // Si falla (p. ej. otro vendedor se llevó el stock), el carrito se conserva para corregir.
    if (!r.ok) return toast(r.error, 'err');
    toast(`Venta ${r.data.factura} registrada`, 'ok');
    onDone();
    modal.open(<InvoiceModal ventaId={r.data.ventaId} efectivo={efectivo} />);
  };

  return (
    <Modal
      title="Confirmar venta"
      footer={
        <>
          <CancelButton label="Volver al carrito" />
          <button className="b b-amber" onClick={confirmar} disabled={saving || bloqueada} autoFocus>
            {saving ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </>
      }
    >
      <SaleSummary cliente={cliente} lines={lines} totals={totals} terms={terms} efectivo={efectivo} />
    </Modal>
  );
}
