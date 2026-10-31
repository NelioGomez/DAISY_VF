/* Avisa si alguna colección que usa la pantalla no se pudo cargar y permite reintentar solo
   esa parte, sin recargar la página ni cerrar la sesión (mejora n.° 29). */
import { useState } from 'react';
import { useData } from '../../store/hooks';
import type { RefreshKey } from '../../store/storeContext';
import { ErrorState } from './ErrorState';

const NOMBRE: Record<RefreshKey, string> = {
  productos: 'productos',
  catalogos: 'categorías y marcas',
  movimientos: 'movimientos de inventario',
  compras: 'compras',
  clientes: 'clientes',
  proveedores: 'proveedores',
  ventas: 'ventas',
  cotizaciones: 'cotizaciones',
  pagos: 'pagos',
  cxc: 'cuentas por cobrar',
  ordenes: 'órdenes de servicio',
  consultas: 'consultas web',
  auditoria: 'auditoría',
  dashboard: 'indicadores',
  config: 'configuración',
};

export function LoadErrors({ keys }: { keys: RefreshKey[] }) {
  const { failed, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const bad = keys.filter((k) => failed[k]);
  if (!bad.length) return null;
  const retry = async () => {
    setBusy(true);
    await refresh(bad);
    setBusy(false);
  };
  return (
    <ErrorState
      title={`No se pudo cargar: ${bad.map((k) => NOMBRE[k]).join(', ')}.`}
      msg={busy ? 'Reintentando…' : `${failed[bad[0]]} Lo demás de la pantalla funciona; los datos de esa parte pueden estar incompletos.`}
      onRetry={busy ? undefined : () => void retry()}
    />
  );
}
