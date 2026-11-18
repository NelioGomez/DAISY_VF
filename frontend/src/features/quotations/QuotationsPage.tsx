/* MÓDULO: COTIZACIONES (RF-10 / RF-11)
   Flujo del servidor: Borrador → Pendiente → Aprobada → Convertida.
   Pendiente o Aprobada pueden rechazarse; vencen al pasar su validez. */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { Cotizacion } from '../../types';
import { fmtDate, matches, money } from '../../utils/format';
import { SaleFormModal } from '../sales/SaleFormModal';
import { QuotationFormModal } from './QuotationFormModal';
import { RejectQuotationModal } from './RejectQuotationModal';

export function QuotationsPage() {
  const { db, cambiarEstadoCotizacion, obtenerCotizacion } = useData();
  const { can } = useAuth();
  const canWrite = can('quotations:write');
  const canConvert = canWrite && can('sales:write');
  const modal = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = db.cotizaciones.filter((c) => matches(q, c.codigo, fmtDate(c.fecha), c.cliN, money(c.total), c.estado));

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
        desc="Proformas con validez de 15 días. Las aprobadas se convierten en venta sin volver a digitar (RF-11)."
        actions={
          canWrite && can('customers:read') && can('products:read') && (
            <button className="b b-amber" onClick={() => modal.open(<QuotationFormModal />)}>
              + Nueva cotización
            </button>
          )
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar cotización…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Emisión</th>
              <th>Cliente</th>
              <th className="num">Total</th>
              <th>Válida hasta</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.cotizaciones.length && <EmptyRow cols={7} msg="Sin cotizaciones" />}
            {rows.map((c) => {
              const working = busy === c.id;
              return (
                <tr key={c.id}>
                  <td className="mono">{c.codigo}</td>
                  <td className="mono">{fmtDate(c.fecha)}</td>
                  <td>{c.cliN}</td>
                  <td className="num">{money(c.total)}</td>
                  <td className="mono">{fmtDate(c.validaHasta)}</td>
                  <td>
                    <EstadoTag estado={c.estado} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
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
