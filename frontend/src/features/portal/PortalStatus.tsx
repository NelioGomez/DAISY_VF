/* Estado de solicitudes y cotizaciones en el portal: ícono + texto (no solo color). */
import type { EstadoConsulta, EstadoCotizacion } from '../../types';

const TONE: Record<string, { cls: string; ic: string }> = {
  Nueva: { cls: 'is-new', ic: '●' },
  'En revisión': { cls: 'is-progress', ic: '◷' },
  Cotizada: { cls: 'is-done', ic: '✓' },
  Cerrada: { cls: 'is-muted', ic: '■' },
  Cancelada: { cls: 'is-bad', ic: '✕' },
  Borrador: { cls: 'is-muted', ic: '◌' },
  Pendiente: { cls: 'is-progress', ic: '◷' },
  Aprobada: { cls: 'is-done', ic: '✓' },
  Rechazada: { cls: 'is-bad', ic: '✕' },
  Convertida: { cls: 'is-done', ic: '✓' },
  Vencida: { cls: 'is-muted', ic: '⊘' },
};

export function PortalState({ estado }: { estado: EstadoConsulta | EstadoCotizacion }) {
  const t = TONE[estado] ?? { cls: 'is-muted', ic: '●' };
  return (
    <span className={`pub-state ${t.cls}`}>
      <span aria-hidden="true">{t.ic}</span> {estado}
    </span>
  );
}

const STEPS: Array<{ label: string; at: EstadoConsulta[] }> = [
  { label: 'Nueva', at: ['Nueva', 'En revisión', 'Cotizada', 'Cerrada'] },
  { label: 'En revisión', at: ['En revisión', 'Cotizada', 'Cerrada'] },
  { label: 'Cotizada', at: ['Cotizada', 'Cerrada'] },
];

/** Avance de la solicitud: Nueva → En revisión → Cotizada. */
export function InquiryProgress({ estado }: { estado: EstadoConsulta }) {
  if (estado === 'Cancelada') return null;
  return (
    <ol className="pub-progress" aria-label="Avance de la solicitud">
      {STEPS.map((s) => {
        const done = s.at.includes(estado);
        return (
          <li key={s.label} className={done ? 'is-done' : ''}>
            {s.label}
            <span className="sr-only">{done ? ' (completado)' : ' (pendiente)'}</span>
          </li>
        );
      })}
    </ol>
  );
}
