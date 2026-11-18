import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { LineEditor } from '../../components/forms/LineEditor';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CartLine } from '../../types';

export function QuotationFormModal() {
  const { db, crearCotizacion } = useData();
  const toast = useToast();
  const { close } = useModal();
  const activos = db.clientes.filter((c) => c.activo);
  const [cliId, setCliId] = useState(activos[0]?.id ?? '');
  const [lines, setLines] = useState<CartLine[]>([{ prod: '', cant: 1 }]);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!cliId) return toast('Seleccione un cliente', 'err');
    if (!lines.some((l) => l.prod && l.cant > 0)) return toast('Agregue al menos un producto', 'err');
    setSaving(true);
    const r = await crearCotizacion(cliId, lines, notas);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast('Cotización ' + r.data + ' generada', 'ok');
    close();
  };

  return (
    <Modal
      title="Nueva cotización"
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Generando…' : 'Generar cotización'}
          </button>
        </>
      }
    >
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
      <Field label="Notas para el cliente" full>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" maxLength={500} />
      </Field>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>Los precios e impuestos definitivos los calcula el servidor. La cotización vale 15 días desde su emisión.</div>
      </div>
    </Modal>
  );
}
