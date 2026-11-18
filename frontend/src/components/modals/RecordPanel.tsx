/* Panel lateral de registro (mejoras n.° 32 y 33).
   Envuelve la vista de detalle de un registro (factura, cotización, producto, cliente…):
   - avisa a la barra superior qué registro está abierto (ruta Inicio › Módulo › Registro);
   - hace que <Modal> y <Drawer> se dibujen como panel lateral y no como ventana centrada.
   En pantallas anchas el panel queda a la derecha y la lista sigue usable (vista dividida);
   en pantallas angostas se superpone debajo de la barra superior, que sigue visible. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RecordContext, useRecordLabel } from './recordContext';
import { recordStore } from './recordStore';
import { useModal } from './useModal';

export function RecordPanel({ recordKey, children }: { recordKey: string; children: ReactNode }) {
  // useLayoutEffect: se registra antes de los efectos de los hijos (que fijan la etiqueta).
  useLayoutEffect(() => {
    recordStore.open(recordKey);
    return () => recordStore.close(recordKey);
  }, [recordKey]);
  return <RecordContext.Provider value={recordKey}>{children}</RecordContext.Provider>;
}

const SPLIT_QUERY = '(min-width: 1440px)';

/** true en pantallas donde caben la lista y el panel uno al lado del otro. */
function useSplitView(): boolean {
  const [split, setSplit] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(SPLIT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(SPLIT_QUERY);
    if (!mq) return;
    const onChange = () => setSplit(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return split;
}

interface PanelShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}

/** Marco del panel lateral de un registro: encabezado con ×, cuerpo con scroll y pie. */
export function PanelShell({ title, subtitle, children, footer, wide, className = '' }: PanelShellProps) {
  const { close } = useModal();
  const split = useSplitView();
  const panel = useRef<HTMLDivElement>(null);
  // El título del panel ("Factura FAC-000125", nombre del producto…) es el último tramo de la ruta.
  useRecordLabel(title);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Vista dividida: la lista se corre a la izquierda para que el panel no la tape.
  useEffect(() => {
    if (!split) return;
    document.body.classList.add('record-split');
    return () => document.body.classList.remove('record-split');
  }, [split]);

  const box = (
    <div
      className={`drawer record-panel ${wide ? 'wide' : ''} ${split ? 'is-split' : ''} ${className}`}
      role="dialog"
      aria-modal={!split}
      aria-label={title}
      tabIndex={-1}
      ref={panel}
    >
      <div className="drawer-h">
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>
          {subtitle && <div className="drawer-sub">{subtitle}</div>}
        </div>
        <button className="x" onClick={close} aria-label="Cerrar panel" title="Cerrar (Esc)">
          ×
        </button>
      </div>
      <div className="drawer-b">{children}</div>
      {footer && <div className="drawer-f">{footer}</div>}
    </div>
  );

  if (split) return box;
  return (
    <div className="drawer-bg record-bg" onClick={(e) => e.target === e.currentTarget && close()}>
      {box}
    </div>
  );
}
