import { useContext } from 'react';
import { ModalContext, type ModalApi } from './modalContext';

export function useModal(): ModalApi {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal debe usarse dentro de <ModalProvider>');
  return ctx;
}
