/* Motivo de una solicitud web (mejora n.° 59), con ícono + texto. */
import { Icon } from '../../components/common/Icon';
import { Tag } from '../../components/tables/Tag';
import type { TipoConsulta } from '../../types';
import { TIPO_CONSULTA } from './tiposConsulta';

export function TipoConsultaTag({ tipo }: { tipo: TipoConsulta }) {
  const t = TIPO_CONSULTA[tipo];
  return (
    <Tag tone={t.tone}>
      <Icon name={t.ic} size={12} strokeWidth={2.4} />
      {t.label}
    </Tag>
  );
}
