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
  const [cliId, setCliId] = useState(db.clientes[0]?.id ?? '');
  const [lines, setLines] = useState<CartLine[]>([{ prod: '', cant: 1 }]);

  const save = () => {
    const r = crearCotizacion(cliId, lines);
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
          <button className="b b-amber" onClick={save}>
            Generar cotización
          </button>
        </>
      }
    >
      <Field label="Cliente">
        <select value={cliId} onChange={(e) => setCliId(e.target.value)}>
          {db.clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>
      <LineEditor lines={lines} onChange={setLines} />
    </Modal>
  );
}
