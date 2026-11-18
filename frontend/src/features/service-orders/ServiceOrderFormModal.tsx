import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';

export function ServiceOrderFormModal() {
  const { db, crearOrden } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [cliente, setCliente] = useState(db.clientes[0]?.nombre ?? '');
  const [desc, setDesc] = useState('');
  const [tecnico, setTecnico] = useState('');

  const save = () => {
    const r = crearOrden(cliente, desc, tecnico);
    if (!r.ok) return toast(r.error, 'err');
    toast('Orden ' + r.data + ' creada', 'ok');
    close();
  };

  return (
    <Modal
      title="Nueva orden de servicio"
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save}>
            Crear orden
          </button>
        </>
      }
    >
      <Field label="Cliente">
        <select value={cliente} onChange={(e) => setCliente(e.target.value)}>
          {db.clientes.map((c) => (
            <option key={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Field>
      <Field label="Descripción del servicio">
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <InputField label="Técnico asignado" value={tecnico} onChange={setTecnico} help="Opcional — puede asignarse luego" />
    </Modal>
  );
}
