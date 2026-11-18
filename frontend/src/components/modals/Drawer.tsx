/* Panel lateral de detalle (mejora n.° 33): se abre sobre la lista sin perder el contexto.
   Abierto como registro (useRecords().openRecord) usa la vista dividida o superpuesta de
   PanelShell; fuera de un registro se superpone a toda la pantalla. Se cierra con ×, clic
   fuera o la tecla Esc. */
import { useEffect, useRef, type ReactNode } from 'react';
import { useInRecord } from './recordContext';
import { PanelShell } from './RecordPanel';
import { useModal } from './useModal';

interface DrawerProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer(props: DrawerProps) {
  const inRecord = useInRecord();
  return inRecord ? <PanelShell {...props} /> : <OverlayDrawer {...props} />;
}

function OverlayDrawer({ title, subtitle, children, footer }: DrawerProps) {
  const { close } = useModal();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="drawer-bg" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <div className="drawer-h">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="drawer-sub">{subtitle}</div>}
          </div>
          <button className="x" onClick={close} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="drawer-b">{children}</div>
        {footer && <div className="drawer-f">{footer}</div>}
      </div>
    </div>
  );
}
