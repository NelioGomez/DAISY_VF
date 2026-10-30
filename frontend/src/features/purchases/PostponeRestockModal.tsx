/* "Posponer" una sugerencia de compra: la persona decide que todavía no conviene comprar. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { SugerenciaReposicion } from '../../types';

const OPCIONES = [3, 7, 15, 30];

export function PostponeRestockModal({ sugerencia, onDone }: { sugerencia: SugerenciaReposicion; onDone(): void }) {
  const { posponerReposicion } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    setSaving(true);
    const r = await posponerReposicion(sugerencia.prod, dias, motivo);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${sugerencia.sku} pospuesto ${dias} días`, 'ok');
    onDone();
    close();
  };

  return (
    <Modal
      title={`Posponer · ${sugerencia.sku}`}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : `Posponer ${dias} días`}
          </button>
        </>
      }
    >
      <p className="doc-meta" style={{ marginBottom: 12 }}>
        {sugerencia.prodN}: stock {sugerencia.stock} de mínimo {sugerencia.stockMin}. Mientras esté pospuesto no aparece en el panel; puede reactivarlo cuando quiera.
      </p>
      <div className="form-grid">
        <Field label="Durante" htmlFor="pp-dias">
          <select id="pp-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {OPCIONES.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motivo (opcional)" htmlFor="pp-motivo">
          <input id="pp-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} placeholder="Ej: esperando lista de precios" />
        </Field>
      </div>
    </Modal>
  );
}
