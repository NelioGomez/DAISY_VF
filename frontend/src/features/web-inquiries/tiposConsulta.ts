/* Motivos de una solicitud web (mejora n.° 59): orden de los filtros y texto para el personal. */
import type { IconName } from '../../components/common/Icon';
import type { TagTone } from '../../components/tables/Tag';
import type { TipoConsulta } from '../../types';

export const TIPOS_CONSULTA: TipoConsulta[] = ['Cotización', 'Servicio técnico', 'Cuenta', 'Reclamo', 'Otra'];

export const TIPO_CONSULTA: Record<TipoConsulta, { tone: TagTone; ic: IconName; label: string }> = {
  Cotización: { tone: 't-blue', ic: 'file-text', label: 'Cotización' },
  'Servicio técnico': { tone: 't-amber', ic: 'wrench', label: 'Servicio o garantía' },
  Cuenta: { tone: 't-violet', ic: 'user-round', label: 'Cuenta del cliente' },
  Reclamo: { tone: 't-red', ic: 'message-square-warning', label: 'Reclamo' },
  Otra: { tone: 't-gray', ic: 'circle-help', label: 'Otra consulta' },
};

export const etiquetaTipo = (t: TipoConsulta) => TIPO_CONSULTA[t].label;
