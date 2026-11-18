/* Orden de providers: Router → Store (datos/sesión) → Toasts → Modales.
   Los modales van al final para que su contenido tenga acceso a todo. */
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/feedback/ToastProvider';
import { ModalProvider } from '../../components/modals/ModalProvider';
import { StoreProvider } from '../../store/StoreProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ToastProvider>
          <ModalProvider>{children}</ModalProvider>
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}
