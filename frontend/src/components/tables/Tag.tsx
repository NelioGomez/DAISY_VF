import type { ReactNode } from 'react';

export type TagTone = 't-green' | 't-red' | 't-amber' | 't-blue' | 't-gray' | 't-violet';

export function Tag({ children, tone = 't-gray' }: { children: ReactNode; tone?: TagTone }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

const ESTADO_TONES: Record<string, TagTone> = {
  Pagada: 't-green',
  Pendiente: 't-amber',
  Parcial: 't-blue',
  Anulada: 't-gray',
  Aprobada: 't-green',
  Registrada: 't-gray',
  Asignada: 't-blue',
  'En proceso': 't-amber',
  Completada: 't-green',
  Facturada: 't-violet',
  Cancelada: 't-red',
  Nueva: 't-amber',
  'En revisión': 't-blue',
  Cotizada: 't-violet',
  Cerrada: 't-gray',
  Borrador: 't-gray',
  Rechazada: 't-red',
  Convertida: 't-violet',
  Vencida: 't-gray',
  Ordenada: 't-amber',
  Recibida: 't-green',
  // Producción y calidad
  Liberada: 't-blue',
  Terminada: 't-green',
  'Por inspeccionar': 't-amber',
  'En retrabajo': 't-violet',
  Liberado: 't-green',
  Desechado: 't-red',
  Conforme: 't-green',
  'No conforme': 't-red',
  Vigente: 't-green',
  Inactiva: 't-gray',
};

/** Ícono que acompaña al texto del estado: el estado no depende solo del color (WCAG). */
const ESTADO_ICONS: Record<string, string> = {
  Pagada: '✓',
  Recibida: '✓',
  Completada: '✓',
  Aprobada: '✓',
  Pendiente: '◷',
  Ordenada: '◷',
  'En proceso': '◷',
  'En revisión': '◷',
  Parcial: '◑',
  Nueva: '●',
  Cancelada: '✕',
  Rechazada: '✕',
  Anulada: '⊘',
  Vencida: '⊘',
  Convertida: '→',
  Cotizada: '→',
  Facturada: '→',
  Liberada: '▶',
  Terminada: '✓',
  'Por inspeccionar': '◷',
  'En retrabajo': '↺',
  Liberado: '✓',
  Desechado: '✕',
  Conforme: '✓',
  'No conforme': '✕',
  Vigente: '✓',
};

export function EstadoTag({ estado }: { estado: string }) {
  const ic = ESTADO_ICONS[estado];
  return (
    <Tag tone={ESTADO_TONES[estado] ?? 't-gray'}>
      {ic && <span aria-hidden="true">{ic}</span>}
      {estado}
    </Tag>
  );
}

/** Estado de existencias con ícono y texto (no depende solo del color). */
export function StockTag({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0)
    return (
      <Tag tone="t-red">
        <span aria-hidden="true">✕</span> Agotado
      </Tag>
    );
  if (stock <= min)
    return (
      <Tag tone="t-amber">
        <span aria-hidden="true">▼</span> Crítico
      </Tag>
    );
  return (
    <Tag tone="t-green">
      <span aria-hidden="true">✓</span> OK
    </Tag>
  );
}

export function TipoMovTag({ tipo }: { tipo: string }) {
  return <Tag tone={tipo === 'Entrada' ? 't-green' : tipo === 'Salida' ? 't-red' : 't-blue'}>{tipo}</Tag>;
}
