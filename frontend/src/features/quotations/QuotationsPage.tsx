/* MÓDULO: COTIZACIONES (RF-10 / RF-11)
   Flujo del servidor: Borrador → Pendiente → Aprobada → Convertida.
   Pendiente o Aprobada pueden rechazarse; vencen al pasar su validez.
   Muestra la antigüedad del estado (mejora n.° 15) y el origen web (n.° 50). */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { Cotizacion } from '../../types';
import { ago, daysSince, fmtDate, matches, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { SaleFormModal } from '../sales/SaleFormModal';
import { QuotationDetailModal } from './QuotationDetailModal';
import { QuotationFormModal } from './QuotationFormModal';
import { RejectQuotationModal } from './RejectQuotationModal';

/** Días en Pendiente a partir de los cuales conviene dar seguimiento. */
const SEGUIMIENTO_DIAS = 5;

export function QuotationsPage() {
  const { db, cambiarEstadoCotizacion, obtenerCotizacion } = useData();
  const { can } = useAuth();
  const canWrite = can('quotations:write');
  const canConvert = canWrite && can('sales:write');
  const modal = useModal();
  const toast = useToast();
  const doc = useOpenDocument();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = db.cotizaciones.filter((c) => matches(q, c.codigo, fmtDate(c.fecha), c.cliN, money(c.total), c.estado, c.solicitud?.codigo));

  const transition = async (c: Cotizacion, accion: 'submit' | 'approve') => {
    setBusy(c.id);
    const r = await cambiarEstadoCotizacion(c.id, accion);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c.codigo} ${accion === 'approve' ? 'aprobada' : 'enviada'}`, 'ok');
  };

  const convertir = async (c: Cotizacion) => {
    setBusy(c.id);
    const r = await obtenerCotizacion(c.id);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    modal.open(<SaleFormModal cotizacion={r.data} />);
  };

  return (
    <>
      <ViewHead
        title="Cotizaciones"
        desc="Proformas con validez de 15 días. Las aprobadas se convierten en venta sin volver a digitar (RF-11). Haga clic en una fila para ver el detalle y su origen."
        actions={
          canWrite && can('customers:read') && can('products:read') && (
            <button className="b b-amber" onClick={() => modal.open(<QuotationFormModal />)}>
              + Nueva cotización
            </button>
          )
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar cotización, cliente o solicitud…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Emisión</th>
              <th>Cliente</th>
              <th>Origen</th>
              <th className="num">Total</th>
              <th>Válida hasta</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.cotizaciones.length && <EmptyRow cols={8} msg="Sin cotizaciones" />}
            {rows.map((c) => {
              const working = busy === c.id;
              const dias = daysSince(c.estadoDesde);
              const seguimiento = c.estado === 'Pendiente' && dias >= SEGUIMIENTO_DIAS;
              return (
                <tr key={c.id} className="row-link" onClick={() => modal.open(<QuotationDetailModal cotizacionId={c.id} />)}>
                  <td className="mono">{c.codigo}</td>
                  <td className="mono">{fmtDate(c.fecha)}</td>
                  <td>{c.cliN}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {c.solicitud ? (
                      <DocChip
                        tipo="SOLICITUD"
                        codigo={c.solicitud.codigo}
                        onOpen={doc.canOpen({ tipo: 'SOLICITUD' }) ? () => doc.open({ tipo: 'SOLICITUD', ...c.solicitud! }) : undefined}
                      />
                    ) : (
                      <span className="muted-sm">Interna</span>
                    )}
                  </td>
                  <td className="num">{money(c.total)}</td>
                  <td className="mono">{fmtDate(c.validaHasta)}</td>
                  <td>
                    <EstadoTag estado={c.estado} />
                    <div className={`age ${seguimiento ? 'is-late' : ''}`} title={`Desde ${fmtDate(c.estadoDesde)}`}>
                      {ago(c.estadoDesde)}
                      {seguimiento && ' · dar seguimiento'}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {c.estado === 'Convertida' ? (
                      <Tag tone="t-violet">{c.factura ?? 'Convertida'}</Tag>
                    ) : !canWrite || ['Rechazada', 'Vencida'].includes(c.estado) ? null : (
                      <>
                        {c.estado === 'Borrador' && (
                          <button className="b b-out b-sm" disabled={working} onClick={() => transition(c, 'submit')}>
                            Enviar
                          </button>
                        )}
                        {c.estado === 'Pendiente' && (
                          <button className="b b-out b-sm" disabled={working} onClick={() => transition(c, 'approve')}>
                            Aprobar
                          </button>
                        )}{' '}
                        {c.estado === 'Aprobada' && canConvert && (
                          <button className="b b-green b-sm" disabled={working} onClick={() => convertir(c)}>
                            → Venta
                          </button>
                        )}{' '}
                        {(c.estado === 'Pendiente' || c.estado === 'Aprobada') && (
                          <button className="b b-red b-sm" disabled={working} onClick={() => modal.open(<RejectQuotationModal cotizacion={c} />)}>
                            Rechazar
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
