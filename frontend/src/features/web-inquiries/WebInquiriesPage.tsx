/* MÓDULO: CONSULTAS WEB (RF-17) — solicitudes del catálogo público y del portal de clientes.
   Se conservan siempre (evidencia): Nueva → En revisión → Cotizada → Cerrada; Cancelada para spam o duplicadas.
   Abrir una solicitud permite crear la cotización precargada (mejora n.° 45). Cada una trae su
   motivo (n.° 59): solo las de cotización se cotizan. Filtros con chips y paginación (n.° 18-20). */
import { ViewHead } from '../../components/common/ViewHead';
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import type { ConsultaWeb, EstadoConsulta } from '../../types';
import { ago, fmtDate } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { useRecords } from '../records/records';
import { TipoConsultaTag } from './TipoConsultaTag';
import { TIPOS_CONSULTA, etiquetaTipo } from './tiposConsulta';

const ESTADOS: Array<EstadoConsulta | 'Todas'> = ['Todas', 'Nueva', 'En revisión', 'Cotizada', 'Cerrada', 'Cancelada'];

export function WebInquiriesPage() {
  const { db } = useData();
  const { openRecord } = useRecords();
  const doc = useOpenDocument();
  const selects: SelectFilter<ConsultaWeb>[] = [
    { key: 'estado', label: 'Estado', options: ESTADOS.filter((x) => x !== 'Todas').map((x) => ({ value: x, label: x })), test: (c, v) => c.estado === v },
    { key: 'tipo', label: 'Motivo', options: TIPOS_CONSULTA.map((x) => ({ value: x, label: etiquetaTipo(x) })), test: (c, v) => c.tipo === v },
    {
      key: 'origen',
      label: 'Origen',
      options: [
        { value: 'PORTAL', label: 'Portal de clientes' },
        { value: 'WEB', label: 'Formulario web' },
      ],
      test: (c, v) => c.origen === v,
    },
  ];
  const f = useListFilters(db.consultas, { search: (c) => [c.codigo, c.nombre, c.contacto, c.producto, c.msg, c.cliente?.nombre], selects, date: (c) => c.fecha });
  const rows = f.filtered;
  const pg = usePaged(rows, f.key, 'consultas-web');

  return (
    <>
      <ViewHead
        title="Consultas Web"
        desc="Solicitudes del catálogo público, del formulario de Contacto y del portal de clientes (RF-17). Nunca se borran. Las de cotización se cotizan sin volver a digitar; las de servicio o garantía pasan a una orden de servicio."
      />
      <FilterBar f={f} placeholder="Buscar por código, cliente, contacto o producto…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente / Empresa</th>
              <th>Motivo</th>
              <th>Solicita</th>
              <th>Estado</th>
              <th>Atendida con</th>
            </tr>
          </thead>
          <tbody>
            {!db.consultas.length && <EmptyRow cols={7} msg="Sin consultas" />}
            {!!db.consultas.length && !rows.length && <EmptyRow cols={7} msg="Ninguna solicitud coincide con el filtro" ic="🔍" />}
            {pg.pageRows.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => openRecord('solicitud', c.id)}>
                <td className="mono">{c.codigo || '—'}</td>
                <td className="mono">{fmtDate(c.fecha)}</td>
                <td>
                  <b>{c.nombre}</b>
                  <div className="muted-sm mono">{c.contacto}</div>
                  {c.origen === 'PORTAL' && <div className="muted-sm">con cuenta del portal</div>}
                </td>
                <td>
                  <TipoConsultaTag tipo={c.tipo} />
                </td>
                <td style={{ maxWidth: 280 }}>
                  {c.items.length ? `${c.items.length} producto(s): ${c.items.map((i) => `${i.cant}× ${i.sku}`).join(', ')}` : c.producto || c.msg || '—'}
                </td>
                <td>
                  <EstadoTag estado={c.estado} />
                  <div className={`age ${c.estado === 'Nueva' && ago(c.estadoDesde) !== 'hoy' ? 'is-late' : ''}`}>{ago(c.estadoDesde)}</div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {c.cotizacion ? (
                    <DocChip
                      tipo="COTIZACION"
                      codigo={c.cotizacion.codigo}
                      detalle={c.cotizacion.factura ? `→ ${c.cotizacion.factura.codigo}` : c.cotizacion.estado}
                      onOpen={doc.canOpen({ tipo: 'COTIZACION' }) ? () => doc.open({ tipo: 'COTIZACION', id: c.cotizacion!.id, codigo: c.cotizacion!.codigo }) : undefined}
                    />
                  ) : c.ordenServicio ? (
                    <DocChip
                      tipo="SERVICIO"
                      codigo={c.ordenServicio.codigo}
                      detalle={c.ordenServicio.enGarantia ? `${c.ordenServicio.estado} · garantía` : c.ordenServicio.estado}
                      onOpen={doc.canOpen({ tipo: 'SERVICIO' }) ? () => doc.open({ tipo: 'SERVICIO', id: c.ordenServicio!.id, codigo: c.ordenServicio!.codigo }) : undefined}
                    />
                  ) : (
                    <span className="muted-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="solicitudes" />
    </>
  );
}
