import { useEffect, type ReactNode } from 'react';
import { useInRecord } from './recordContext';
import { PanelShell } from './RecordPanel';
import { useModal } from './useModal';

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Clase extra, p. ej. "print-doc" para que la impresión muestre solo este documento. */
  className?: string;
}

/** Ventana centrada; dentro de un panel de registro (mejora n.° 33) se dibuja como panel lateral. */
export function Modal(props: ModalProps) {
  const inRecord = useInRecord();
  return inRecord ? <PanelShell {...props} /> : <CenteredModal {...props} />;
}

function CenteredModal({ title, children, footer, wide, className = '' }: ModalProps) {
  const { close } = useModal();
  // Esc cierra la ventana (atajo de teclado, mejora n.° 31).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          <h3>{title}</h3>
          <button className="x" onClick={close} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

/** Botón "Cancelar" estándar de los pies de modal. */
export function CancelButton({ label = 'Cancelar' }: { label?: string }) {
  const { close } = useModal();
  return (
    <button className="b b-out" onClick={close}>
      {label}
    </button>
  );
}
