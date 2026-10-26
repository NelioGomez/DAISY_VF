/* Gestor de modales: equivalente a modal()/closeModal() del prototipo.
   Una página abre un modal con open(<ComponenteModal />) y este se
   renderiza en #modalRoot con acceso a todos los contextos. */
import { useMemo, useState, type ReactNode } from 'react';
import { ModalContext, type ModalApi } from './modalContext';

export function ModalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const api = useMemo<ModalApi>(() => ({ open: (n) => setNode(n), close: () => setNode(null) }), []);

  return (
    <ModalContext.Provider value={api}>
      {children}
      <div id="modalRoot">{node}</div>
    </ModalContext.Provider>
  );
}
