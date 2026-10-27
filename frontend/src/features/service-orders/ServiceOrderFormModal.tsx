import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';

export function ServiceOrderFormModal() {
  const { db, crearOrden } = useData();
  const toast = useToast();
  const { close } = useModal();
  const activos = db.clientes.filter((c) => c.activo);
  const [cliId, setCliId] = useState(activos[0]?.id ?? '');
  const [desc, setDesc] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!cliId) return toast('Seleccione un cliente', 'err');
    if (!desc.trim()) return toast('Describa el servicio', 'err');
    setSaving(true);
    const r = await crearOrden(cliId, desc.trim(), tecnicoId || null);
    setSaving(false);
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
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Creando…' : 'Crear orden'}
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
      <Field label="Descripción del servicio">
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <Field label="Técnico asignado" help="Opcional: puede asignarse después">
        <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
          <option value="">— Sin asignar —</option>
          {db.tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}
