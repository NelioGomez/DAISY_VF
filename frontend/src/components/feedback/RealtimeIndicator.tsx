/* Estado del canal en tiempo real, en la barra superior.
   Un clic activa o silencia los avisos de cambios de otros usuarios
   (los datos se siguen actualizando igual). */
import type { RealtimeStatus } from '../../services/realtime/realtime';

const LABEL: Record<RealtimeStatus, string> = {
  online: 'En vivo',
  connecting: 'Conectando…',
  offline: 'Reconectando…',
  off: 'Sin conexión',
};

const HELP: Record<RealtimeStatus, string> = {
  online: 'Los cambios de otros usuarios aparecen sin recargar la página.',
  connecting: 'Abriendo el canal en tiempo real con el servidor.',
  offline: 'Se perdió el canal en tiempo real. Se reintenta solo; al volver se actualizan los datos.',
  off: 'El canal en tiempo real no está activo.',
};

interface Props {
  status: RealtimeStatus;
  notices: boolean;
  onToggleNotices(): void;
}

export function RealtimeIndicator({ status, notices, onToggleNotices }: Props) {
  const title = `${HELP[status]}\nAvisos de otros usuarios: ${notices ? 'activados' : 'silenciados'} (clic para ${notices ? 'silenciar' : 'activar'}).`;
  return (
    <button type="button" className={`rt-pill is-${status}`} title={title} aria-label={`${LABEL[status]}. ${title}`} onClick={onToggleNotices}>
      <span className="rt-dot" aria-hidden="true" />
      <span className="rt-label">{LABEL[status]}</span>
      {!notices && (
        <span className="rt-muted" aria-hidden="true">
          🔕
        </span>
      )}
    </button>
  );
}
