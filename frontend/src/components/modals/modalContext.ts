import { createContext, type ReactNode } from 'react';

export interface ModalApi {
  open(node: ReactNode): void;
  close(): void;
}

export const ModalContext = createContext<ModalApi | null>(null);
