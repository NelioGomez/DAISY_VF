/* Avisos emergentes. Los errores duran más, se pueden cerrar y se anuncian de inmediato a los
   lectores de pantalla (role="alert"); los demás, de forma educada (role="status"). (n.° 29 y 30) */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastFn, type ToastType } from './toastContext';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

const ICONS: Record<ToastType, string> = { ok: '✓ ', err: '⚠️ ', info: 'ℹ️ ' };
const DURATION: Record<ToastType, number> = { ok: 3200, info: 3200, err: 7000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [announce, setAnnounce] = useState({ polite: '', assertive: '' });
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (msg, type = 'info') => {
      const id = ++nextId.current;
      setItems((prev) => [...prev, { id, msg, type }]);
      setAnnounce(type === 'err' ? { polite: '', assertive: msg } : { polite: msg, assertive: '' });
      setTimeout(() => dismiss(id), DURATION[type]);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'info' ? '' : t.type}`}>
            <span>
              {ICONS[t.type]}
              {t.msg}
            </span>
            {t.type === 'err' && (
              <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announce.polite}
      </div>
      <div className="sr-only" role="alert">
        {announce.assertive}
      </div>
    </ToastContext.Provider>
  );
}
