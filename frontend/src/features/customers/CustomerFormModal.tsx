import { useState } from 'react';
import { InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Cliente } from '../../types';

export function CustomerFormModal({ cliente }: { cliente?: Cliente }) {
  const { guardarCliente } = useData();
  const toast = useToast();
  const { close } = useModal();
  const c = cliente;
  const [f, setF] = useState({
    nombre: c?.nombre ?? '', ruc: c?.ruc ?? '', contacto: c?.contacto ?? '',
    tel: c?.tel ?? '', correo: c?.correo ?? '', dir: c?.dir ?? '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const r = guardarCliente(c?.id ?? null, f);
    if (!r.ok) return toast(r.error, 'err');
    toast('Cliente guardado', 'ok');
    close();
  };

  return (
    <Modal
      title={c ? 'Editar cliente' : 'Nuevo cliente'}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <InputField label="Nombre / razón social" value={f.nombre} onChange={set('nombre')} full />
        <InputField label="RUC / Cédula" value={f.ruc} onChange={set('ruc')} />
        <InputField label="Contacto" value={f.contacto} onChange={set('contacto')} />
        <InputField label="Teléfono" value={f.tel} onChange={set('tel')} />
        <InputField label="Correo" value={f.correo} onChange={set('correo')} />
        <InputField label="Dirección" value={f.dir} onChange={set('dir')} full />
      </div>
    </Modal>
  );
}
