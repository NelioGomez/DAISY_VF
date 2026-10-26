import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';

export function PublicInquiryModal({ producto }: { producto?: string }) {
  const { crearConsulta } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [prod, setProd] = useState(producto ?? '');
  const [msg, setMsg] = useState(producto ? 'Solicito cotización de: ' + producto : '');

  const send = () => {
    const r = crearConsulta(nombre, contacto, msg);
    if (!r.ok) return toast(r.error, 'err');
    close();
    toast('¡Solicitud enviada! Le contactaremos pronto.', 'ok');
  };

  return (
    <Modal
      title="Solicitar cotización"
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={send}>
            Enviar solicitud
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>Complete el formulario y nuestro equipo de ventas le contactará.</p>
      <div className="form-grid">
        <InputField label="Nombre / empresa" value={nombre} onChange={setNombre} full />
        <InputField label="Contacto (tel/correo)" value={contacto} onChange={setContacto} />
        <InputField label="Producto de interés" value={prod} onChange={setProd} />
        <Field label="Mensaje" full>
          <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
