/* Avisos en pantalla cuando OTRO usuario cambia algo que este usuario puede ver.
   Los datos ya se recargan solos (StoreProvider); esto solo informa qué pasó. */
import { useEffect } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { subscribeRealtime, type ChangeEvent } from '../../services/realtime/realtime';
import { useAuth } from '../../store/hooks';

const NOTICES_KEY = 'siven.avisos';

export function readNoticesEnabled(): boolean {
  try {
    return localStorage.getItem(NOTICES_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function storeNoticesEnabled(on: boolean): void {
  try {
    localStorage.setItem(NOTICES_KEY, on ? 'on' : 'off');
  } catch {
    /* sin almacenamiento: la preferencia dura solo esta visita */
  }
}

const MODULE_LABEL: Record<string, string> = {
  products: 'Productos',
  categories: 'Categorías',
  brands: 'Marcas',
  inventory: 'Inventario',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  quotations: 'Cotizaciones',
  sales: 'Ventas',
  payments: 'Pagos',
  'service-orders': 'Órdenes OPI',
  inquiries: 'Consultas web',
  settings: 'Configuración',
};

/** El backend redacta la bitácora con los códigos de la API; se traducen para el aviso. */
const CODES: Record<string, string> = {
  CASH: 'Contado',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
};
const CODE_RE = new RegExp(`\\b(${Object.keys(CODES).join('|')})\\b`, 'g');

export function describeChange(e: ChangeEvent): string | null {
  const label = MODULE_LABEL[e.module];
  if (!label || !e.description) return null; // aviso mínimo (módulo relacionado): solo se recargan datos
  const text = e.description.replace(CODE_RE, (c) => CODES[c] ?? c);
  const who = e.username ? ` · @${e.username}` : '';
  return `${label}: ${text}${who}`;
}

export function useRealtimeNotices(enabled: boolean): void {
  const toast = useToast();
  const { user } = useAuth();
  const myId = user?.id;

  useEffect(() => {
    if (!enabled || !myId) return;
    return subscribeRealtime((e) => {
      if (e.userId && e.userId === myId) return; // lo propio ya se confirmó al hacerlo
      const msg = describeChange(e);
      if (msg) toast(msg, 'info');
    });
  }, [enabled, myId, toast]);
}
