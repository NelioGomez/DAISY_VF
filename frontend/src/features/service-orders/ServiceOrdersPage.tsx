/* MÓDULO: ÓRDENES DE SERVICIO / OPI (RF-21)
   Flujo del servidor: Registrada → Asignada → En proceso → Completada → Facturada.
   Se puede cancelar desde cualquier estado que no sea final. */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { OrdenServicio } from '../../types';
import { fmtDate, matches } from '../../utils/format';
import { OrderActionModal } from './OrderActionModal';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';

export function ServiceOrdersPage() {
  const { db, iniciarOrden, completarOrden } = useData();
  const { can } = useAuth();
  const canWrite = can('service-orders:write');
  const modal = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = db.ordenes.filter((o) => matches(q, o.codigo, fmtDate(o.fecha), o.cli, o.desc, o.tecnico, o.estado));

  const step = async (o: OrdenServicio, accion: 'start' | 'complete') => {
    setBusy(o.id);
    const r = accion === 'start' ? await iniciarOrden(o.id) : await completarOrden(o.id, '');
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${o.codigo}: ${accion === 'start' ? 'en proceso' : 'completada'}`, 'ok');
  };

  const actions = (o: OrdenServicio) => {
    if (o.estado === 'Facturada') return <Tag tone="t-violet">{o.factura ?? 'Facturada'}</Tag>;
    if (o.estado === 'Cancelada') return <Tag>Cerrada</Tag>;
    if (!canWrite) return null;
    const working = busy === o.id;
    return (
      <>
        {o.estado === 'Registrada' && (
          <button className="b b-green b-sm" disabled={working || !db.tecnicos.length} onClick={() => modal.open(<OrderActionModal orden={o} mode="assign" />)}>
            Asignar
          </button>
        )}
        {o.estado === 'Asignada' && (
          <button className="b b-green b-sm" disabled={working} onClick={() => step(o, 'start')}>
            → En proceso
          </button>
        )}
        {o.estado === 'En proceso' && (
          <button className="b b-green b-sm" disabled={working} onClick={() => step(o, 'complete')}>
            → Completada
          </button>
        )}
        {o.estado === 'Completada' && can('sales:read') && (
          <button className="b b-green b-sm" disabled={working} onClick={() => modal.open(<OrderActionModal orden={o} mode="invoice" />)}>
            Facturar
          </button>
        )}{' '}
        <button className="b b-red b-sm" disabled={working} onClick={() => modal.open(<OrderActionModal orden={o} mode="cancel" />)}>
          Cancelar
        </button>
      </>
    );
  };

  return (
    <>
      <ViewHead
        title="Órdenes de Servicio (OPI)"
        desc="Flujo: Registrada → Asignada → En proceso → Completada → Facturada."
        actions={
          canWrite && can('customers:read') && (
            <button className="b b-amber" onClick={() => modal.open(<ServiceOrderFormModal />)}>
              + Nueva orden
            </button>
          )
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar orden…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Descripción</th>
              <th>Técnico</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!db.ordenes.length && <EmptyRow cols={7} msg="Sin órdenes" />}
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.codigo}</td>
                <td className="mono">{fmtDate(o.fecha)}</td>
                <td>{o.cli}</td>
                <td style={{ maxWidth: 260 }}>{o.desc}</td>
                <td>{o.tecnico}</td>
                <td>
                  <EstadoTag estado={o.estado} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{actions(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
