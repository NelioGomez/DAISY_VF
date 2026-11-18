import { useEffect, type ReactNode } from 'react';
import { useModal } from './useModal';

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, children, footer, wide }: ModalProps) {
  const { close } = useModal();
  // Esc cierra la ventana (atajo de teclado, mejora n.° 31).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
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
