import { useContext } from 'react';
import { ToastContext, type ToastFn } from './toastContext';

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
