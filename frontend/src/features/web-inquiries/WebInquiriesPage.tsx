/* MÓDULO: CONSULTAS WEB (RF-17) — solicitudes del catálogo público y del portal de clientes.
   Se conservan siempre (evidencia): Nueva → En revisión → Cotizada → Cerrada; Cancelada para spam o duplicadas.
   Abrir una solicitud permite crear la cotización precargada (mejora n.° 45). */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import type { EstadoConsulta } from '../../types';
import { ago, fmtDate, matches } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { InquiryDetailModal } from './InquiryDetailModal';

const ESTADOS: Array<EstadoConsulta | 'Todas'> = ['Todas', 'Nueva', 'En revisión', 'Cotizada', 'Cerrada', 'Cancelada'];

export function WebInquiriesPage() {
  const { db } = useData();
  const modal = useModal();
  const doc = useOpenDocument();
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('Todas');
  const rows = db.consultas.filter(
    (c) => (estado === 'Todas' || c.estado === estado) && matches(q, c.codigo, c.nombre, c.contacto, c.producto, c.msg, c.cliente?.nombre),
  );

  return (
    <>
      <ViewHead
        title="Consultas Web"
        desc="Solicitudes del catálogo público y del portal de clientes (RF-17). Nunca se borran: quedan como evidencia aunque se coticen. Abra una para crear la cotización sin volver a digitar."
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por código, cliente, contacto o producto…">
        <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} aria-label="Estado" className="toolbar-select">
          {ESTADOS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </SearchToolbar>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente / Empresa</th>
              <th>Origen</th>
              <th>Solicita</th>
              <th>Estado</th>
              <th>Cotización</th>
            </tr>
          </thead>
          <tbody>
            {!db.consultas.length && <EmptyRow cols={7} msg="Sin consultas" />}
            {!!db.consultas.length && !rows.length && <EmptyRow cols={7} msg="Ninguna solicitud coincide con el filtro" ic="🔍" />}
            {rows.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => modal.open(<InquiryDetailModal consultaId={c.id} />)}>
                <td className="mono">{c.codigo || '—'}</td>
                <td className="mono">{fmtDate(c.fecha)}</td>
                <td>
                  <b>{c.nombre}</b>
                  <div className="muted-sm mono">{c.contacto}</div>
                </td>
                <td>{c.origen === 'PORTAL' ? <Tag tone="t-violet">Portal</Tag> : <Tag>Formulario</Tag>}</td>
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
                  ) : (
                    <span className="muted-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
