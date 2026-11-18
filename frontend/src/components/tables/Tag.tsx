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
};

export function EstadoTag({ estado }: { estado: string }) {
  return <Tag tone={ESTADO_TONES[estado] ?? 't-gray'}>{estado}</Tag>;
}

export function TipoMovTag({ tipo }: { tipo: string }) {
  return <Tag tone={tipo === 'Entrada' ? 't-green' : tipo === 'Salida' ? 't-red' : 't-blue'}>{tipo}</Tag>;
}
