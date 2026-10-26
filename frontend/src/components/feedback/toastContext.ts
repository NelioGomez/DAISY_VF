import { createContext } from 'react';

export type ToastType = 'ok' | 'err' | 'info';
export type ToastFn = (msg: string, type?: ToastType) => void;

export const ToastContext = createContext<ToastFn | null>(null);
