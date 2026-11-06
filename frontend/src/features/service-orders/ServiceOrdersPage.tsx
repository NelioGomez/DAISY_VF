/* MÓDULO: ÓRDENES DE SERVICIO / OPI (RF-21; garantías, mejora n.° 60)
   Flujo: Registrada → Asignada → En proceso → Completada → Facturada. Una orden en garantía no
   se cobra y termina en Completada. Las tarjetas resumen la carga de trabajo y filtran la tabla;
   cada fila abre el detalle en el panel lateral (?servicio=<id>). */
import { useState, type MouseEvent } from 'react';
import { Icon, type IconName } from '../../components/common/Icon';
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
import { ago, fmtDate } from '../../utils/format';
import { useRecords } from '../records/records';
import { CompleteServiceModal } from './CompleteServiceModal';
import { OrderActionModal } from './OrderActionModal';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';

const ESTADOS_OPI: EstadoOrden[] = ['Registrada', 'Asignada', 'En proceso', 'Completada', 'Facturada', 'Cancelada'];
const EN_CURSO: EstadoOrden[] = ['Registrada', 'Asignada', 'En proceso'];

const enCurso = (o: OrdenServicio) => EN_CURSO.includes(o.estado);
const porFacturar = (o: OrdenServicio) => o.estado === 'Completada' && !o.enGarantia;

const SITUACIONES: Record<string, { label: string; test: (o: OrdenServicio) => boolean }> = {
  curso: { label: 'En curso (registrada, asignada o en proceso)', test: enCurso },
  'sin-tecnico': { label: 'En curso sin técnico', test: (o) => enCurso(o) && !o.tecnicoId },
  facturar: { label: 'Completadas por facturar', test: porFacturar },
};

export function ServiceOrdersPage() {
  const { db, iniciarOrden } = useData();
  const { can, user } = useAuth();
  const canWrite = can('service-orders:write');
  const staff = canWrite && user?.role !== 'tecnico';
  const modal = useModal();
  const toast = useToast();
  const { openRecord } = useRecords();
  const [busy, setBusy] = useState<string | null>(null);
  const tecnicos = [...new Set(db.ordenes.map((o) => o.tecnico).filter((t) => t && t !== '—'))].sort();
  const selects: SelectFilter<OrdenServicio>[] = [
    { key: 'situacion', label: 'Situación', options: Object.entries(SITUACIONES).map(([value, s]) => ({ value, label: s.label })), test: (o, v) => SITUACIONES[v]?.test(o) ?? true },
    { key: 'estado', label: 'Estado', options: ESTADOS_OPI.map((x) => ({ value: x, label: x })), test: (o, v) => o.estado === v },
    {
      key: 'cobertura',
      label: 'Cobertura',
      options: [
        { value: 'garantia', label: 'En garantía (sin costo)' },
        { value: 'costo', label: 'Con costo' },
      ],
      test: (o, v) => (v === 'garantia' ? o.enGarantia : !o.enGarantia),
    },
    ...(tecnicos.length > 1 ? [{ key: 'tecnico', label: 'Técnico', options: tecnicos.map((x) => ({ value: x, label: x })), test: (o: OrdenServicio, v: string) => o.tecnico === v }] : []),
  ];
  const f = useListFilters(db.ordenes, {
    search: (o) => [o.codigo, o.cli, o.desc, o.tecnico, o.factura, o.solicitud?.codigo, o.cobertura?.origen === 'Compra' ? `${o.cobertura.producto} ${o.cobertura.factura}` : o.cobertura?.codigo],
    selects,
    date: (o) => o.fecha,
  });
  const pg = usePaged(f.filtered, f.key, 'ordenes-opi');

  const curso = db.ordenes.filter(enCurso);
  const tarjetas: Array<{ id: string; ic: IconName; label: string; n: number; sub: string; filtro: [string, string]; tone?: 'warn' }> = [
    { id: 'curso', ic: 'wrench', label: 'En curso', n: curso.length, sub: `${curso.filter((o) => o.estado === 'En proceso').length} en proceso`, filtro: ['situacion', 'curso'] },
    {
      id: 'sin-tecnico',
      ic: 'user-cog',
      label: 'Sin técnico',
      n: curso.filter((o) => !o.tecnicoId).length,
      sub: 'por asignar',
      filtro: ['situacion', 'sin-tecnico'],
      tone: curso.some((o) => !o.tecnicoId) ? 'warn' : undefined,
    },
    {
      id: 'garantia',
      ic: 'shield-check',
      label: 'En garantía',
      n: db.ordenes.filter((o) => o.enGarantia).length,
      sub: `${curso.filter((o) => o.enGarantia).length} en curso · sin costo`,
      filtro: ['cobertura', 'garantia'],
    },
    { id: 'facturar', ic: 'receipt', label: 'Por facturar', n: db.ordenes.filter(porFacturar).length, sub: 'completadas con costo', filtro: ['situacion', 'facturar'] },
  ];
  const activa = (t: (typeof tarjetas)[number]) => f.values[t.filtro[0]] === t.filtro[1];
  const toggle = (t: (typeof tarjetas)[number]) => {
    if (t.filtro[0] !== 'situacion' && f.values.situacion) f.setValue('situacion', '');
    if (t.filtro[0] === 'situacion' && f.values.cobertura) f.setValue('cobertura', '');
    f.setValue(t.filtro[0], activa(t) ? '' : t.filtro[1]);
  };

  const iniciar = async (o: OrdenServicio) => {
    setBusy(o.id);
    const r = await iniciarOrden(o.id);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${o.codigo}: en proceso`, 'ok');
  };

  const stop = (e: MouseEvent) => e.stopPropagation();

  const actions = (o: OrdenServicio) => {
    if (o.estado === 'Facturada') return <Tag tone="t-violet">{o.factura ?? 'Facturada'}</Tag>;
    if (o.estado === 'Cancelada') return <Tag>Cerrada</Tag>;
    if (o.estado === 'Completada' && o.enGarantia) return <Tag tone="t-blue">Sin costo</Tag>;
    if (!canWrite) return null;
    const working = busy === o.id;
    return (
      <span className="row-actions" onClick={stop}>
        {o.estado === 'Registrada' && staff && (
          <button className="b b-green b-sm" disabled={working || !db.tecnicos.length} onClick={() => modal.open(<OrderActionModal orden={o} mode="assign" />)}>
            Asignar
          </button>
        )}
        {o.estado === 'Asignada' && (
          <button className="b b-green b-sm" disabled={working} onClick={() => iniciar(o)}>
            → En proceso
          </button>
        )}
        {o.estado === 'En proceso' && (
          <button className="b b-green b-sm" disabled={working} onClick={() => modal.open(<CompleteServiceModal orden={o} />)}>
            → Completada
          </button>
        )}
        {o.estado === 'Completada' && staff && can('sales:read') && (
          <button className="b b-green b-sm" disabled={working} onClick={() => modal.open(<OrderActionModal orden={o} mode="invoice" />)}>
            Facturar
          </button>
        )}
        {staff && (
          <button className="b b-red b-sm" disabled={working} onClick={() => modal.open(<OrderActionModal orden={o} mode="cancel" />)}>
            Cancelar
          </button>
        )}
      </span>
    );
  };

  return (
    <>
      <ViewHead
        title="Órdenes de Servicio (OPI)"
        desc="Registrada → Asignada → En proceso → Completada → Facturada. En garantía, el trabajo no se cobra y termina al completarse."
        actions={
          staff &&
          can('customers:read') && (
            <button className="b b-amber" onClick={() => modal.open(<ServiceOrderFormModal />)}>
              + Nueva orden
            </button>
          )
        }
      />

      <div className="stat-cards" role="group" aria-label="Resumen de órdenes">
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className={`stat-card ${activa(t) ? 'is-on' : ''} ${t.tone === 'warn' ? 'is-warn' : ''}`} aria-pressed={activa(t)} onClick={() => toggle(t)}>
            <span>
              <Icon name={t.ic} size={14} /> {t.label}
            </span>
            <b>{t.n}</b>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>

      <FilterBar f={f} placeholder="Buscar por código, cliente, descripción, técnico, factura o producto en garantía…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Trabajo</th>
              <th>Técnico</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!db.ordenes.length && <EmptyRow cols={7} msg="Sin órdenes de servicio" />}
            {!!db.ordenes.length && !f.filtered.length && <EmptyRow cols={7} msg="Ninguna orden coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((o) => (
              <tr key={o.id} className="row-link" onClick={() => openRecord('servicio', o.id)}>
                <td>
                  <button
                    type="button"
                    className="link-btn mono"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecord('servicio', o.id);
                    }}
                  >
                    {o.codigo}
                  </button>
                  {o.solicitud && <div className="sub-num">desde {o.solicitud.codigo}</div>}
                </td>
                <td className="mono">
                  {fmtDate(o.fecha)}
                  {enCurso(o) && <div className="sub-num">{ago(o.fecha)}</div>}
                </td>
                <td>{o.cli}</td>
                <td style={{ maxWidth: 300 }}>
                  <div className="clamp-2">{o.desc}</div>
                  {o.enGarantia && (
                    <Tag tone="t-blue">
                      <Icon name="shield-check" size={12} strokeWidth={2.4} />
                      {o.cobertura?.origen === 'Compra' ? `Garantía · ${o.cobertura.factura}` : `Garantía · ${o.cobertura?.codigo ?? 'servicio anterior'}`}
                    </Tag>
                  )}
                </td>
                <td>{o.tecnicoId ? o.tecnico : <span className="muted-sm">Sin asignar</span>}</td>
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
