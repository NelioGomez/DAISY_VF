/* Piezas comunes del panel de administración. */
import { useState, type ReactNode } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { errorMessage } from '../../services/api/client';

export function AdminHead({ titulo, desc, acciones }: { titulo: string; desc: string; acciones?: ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{titulo}</h1>
        <p>{desc}</p>
      </div>
      {acciones && <div className="adm-head-actions">{acciones}</div>}
    </div>
  );
}

export function Vacio({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="adm-empty">
        {msg}
      </td>
    </tr>
  );
}

/** Ventana de confirmación; si la acción falla, muestra el error y deja la ventana abierta. */
export function Confirmar({
  titulo,
  boton,
  peligro = false,
  children,
  onConfirmar,
}: {
  titulo: string;
  boton: string;
  peligro?: boolean;
  children: ReactNode;
  onConfirmar: () => Promise<void>;
}) {
  const { close } = useModal();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ok = async () => {
    setBusy(true);
    try {
      await onConfirmar();
      close();
    } catch (e) {
      toast(errorMessage(e), 'err');
      setBusy(false);
    }
  };
  return (
    <Modal
      title={titulo}
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className={`b ${peligro ? 'b-red' : 'b-green'}`} onClick={ok} disabled={busy}>
            {busy ? 'Guardando…' : boton}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
