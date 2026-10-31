/* MÓDULO: ÓRDENES DE SERVICIO / OPI (RF-21)
   Flujo del servidor: Registrada → Asignada → En proceso → Completada → Facturada.
   Se puede cancelar desde cualquier estado que no sea final. Filtros con chips y paginación (n.° 18-20). */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { EstadoOrden, OrdenServicio } from '../../types';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { fmtDate } from '../../utils/format';
import { OrderActionModal } from './OrderActionModal';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';

const ESTADOS_OPI: EstadoOrden[] = ['Registrada', 'Asignada', 'En proceso', 'Completada', 'Facturada', 'Cancelada'];

export function ServiceOrdersPage() {
  const { db, iniciarOrden, completarOrden } = useData();
  const { can } = useAuth();
  const canWrite = can('service-orders:write');
  const modal = useModal();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const tecnicos = [...new Set(db.ordenes.map((o) => o.tecnico).filter(Boolean))].sort();
  const selects: SelectFilter<OrdenServicio>[] = [
    { key: 'estado', label: 'Estado', options: ESTADOS_OPI.map((x) => ({ value: x, label: x })), test: (o, v) => o.estado === v },
    ...(tecnicos.length > 1 ? [{ key: 'tecnico', label: 'Técnico', options: tecnicos.map((x) => ({ value: x, label: x })), test: (o: OrdenServicio, v: string) => o.tecnico === v }] : []),
    {
      key: 'asignacion',
      label: 'Asignación',
      options: [{ value: 'sin', label: 'Sin técnico asignado' }],
      test: (o) => !o.tecnicoId,
    },
  ];
  const f = useListFilters(db.ordenes, { search: (o) => [o.codigo, o.cli, o.desc, o.tecnico, o.factura], selects, date: (o) => o.fecha });
  const pg = usePaged(f.filtered, f.key, 'ordenes-opi');

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
      <FilterBar f={f} placeholder="Buscar por código, cliente, descripción o técnico…" />
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
            {!!db.ordenes.length && !f.filtered.length && <EmptyRow cols={7} msg="Ninguna orden coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((o) => (
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
      <Pagination p={pg} label="órdenes" />
    </>
  );
}
