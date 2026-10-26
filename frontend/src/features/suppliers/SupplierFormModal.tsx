import { useState } from 'react';
import { InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Proveedor } from '../../types';

export function SupplierFormModal({ proveedor }: { proveedor?: Proveedor }) {
  const { guardarProveedor } = useData();
  const toast = useToast();
  const { close } = useModal();
  const p = proveedor;
  const [f, setF] = useState({
    nombre: p?.nombre ?? '', ruc: p?.ruc ?? '', pais: p?.pais ?? '', contacto: p?.contacto ?? '',
    tel: p?.tel ?? '', correo: p?.correo ?? '', dir: p?.dir ?? '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const r = guardarProveedor(p?.id ?? null, f);
    if (!r.ok) return toast(r.error, 'err');
    toast('Proveedor guardado', 'ok');
    close();
  };

  return (
    <Modal
      title={p ? 'Editar proveedor' : 'Nuevo proveedor'}
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
        <InputField label="Nombre del proveedor" value={f.nombre} onChange={set('nombre')} full />
        <InputField label="RUC" value={f.ruc} onChange={set('ruc')} />
        <InputField label="País" value={f.pais} onChange={set('pais')} />
        <InputField label="Contacto" value={f.contacto} onChange={set('contacto')} />
        <InputField label="Teléfono" value={f.tel} onChange={set('tel')} />
        <InputField label="Correo" value={f.correo} onChange={set('correo')} />
        <InputField label="Dirección" value={f.dir} onChange={set('dir')} />
      </div>
    </Modal>
  );
}
