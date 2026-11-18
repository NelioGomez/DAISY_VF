import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastFn, type ToastType } from './toastContext';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

const ICONS: Record<ToastType, string> = { ok: '✓ ', err: '⚠️ ', info: 'ℹ️ ' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback<ToastFn>((msg, type = 'info') => {
    const id = ++nextId.current;
    setItems((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'info' ? '' : t.type}`}>
            {ICONS[t.type]}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
