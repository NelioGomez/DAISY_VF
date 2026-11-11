/* Orden de providers: Router (con la guarda de dominios) → Store (datos/sesión del personal) → Cliente (sesión del
   portal y lista de cotización) → Toasts → Modales.
   Los modales van al final para que su contenido tenga acceso a todo. */
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/feedback/ToastProvider';
import { ModalProvider } from '../../components/modals/ModalProvider';
import { CustomerProvider } from '../../features/portal/CustomerProvider';
import { DomainGuard } from '../router/DomainGuard';
import { StoreProvider } from '../../store/StoreProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <DomainGuard />
      <StoreProvider>
        <CustomerProvider>
          <ToastProvider>
            <ModalProvider>{children}</ModalProvider>
          </ToastProvider>
        </CustomerProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}
