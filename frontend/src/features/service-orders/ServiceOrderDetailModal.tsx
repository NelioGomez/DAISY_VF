/* Detalle de una orden de servicio (OPI) en el panel lateral (mejoras n.° 33 y 60): qué cubre la
   garantía (la compra o el servicio anterior y hasta cuándo), el avance del trabajo, la garantía
   del trabajo realizado y la cadena SOL › OPI › FAC. Desde aquí se avanza la orden y, mientras
   la garantía del trabajo siga vigente, se registra un reclamo sin costo. */
import { useCallback, useEffect, useState } from 'react';
import { DocChain, type ChainItem } from '../../components/common/DocChain';
import { Icon } from '../../components/common/Icon';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { OrdenServicio } from '../../types';
import { fmtDate, fmtDateTime } from '../../utils/format';
import { plazoGarantia, vigenciaTexto, vigente } from '../../utils/warranty';
import { useOpenDocument } from '../documents/useOpenDocument';
import { useRecords } from '../records/records';
import { CompleteServiceModal } from './CompleteServiceModal';
import { OrderActionModal } from './OrderActionModal';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';

export function ServiceOrderDetailModal({ ordenId }: { ordenId: string }) {
  const { db, obtenerOrden, iniciarOrden } = useData();
  const { can, user } = useAuth();
  const canWrite = can('service-orders:write');
  const staff = canWrite && user?.role !== 'tecnico';
  const toast = useToast();
  const modal = useModal();
  const doc = useOpenDocument();
  const { openRecord, canOpenRecord } = useRecords();
  const [o, setO] = useState<OrdenServicio | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  // La lista se refresca en tiempo real; si esta orden cambió allí, se vuelve a leer el detalle.
  const fila = db.ordenes.find((x) => x.id === ordenId);
  const sello = fila ? `${fila.estado}|${fila.tecnicoId}|${fila.factura}` : '';

  useEffect(() => {
    let alive = true;
    void obtenerOrden(ordenId).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setO(r.data);
        setError('');
      } else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [ordenId, obtenerOrden, version, sello]);

  const iniciar = async () => {
    if (!o) return;
    setBusy(true);
    const r = await iniciarOrden(o.id);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${o.codigo} en proceso`, 'ok');
    load();
  };

  const abierta = !!o && ['Registrada', 'Asignada', 'En proceso'].includes(o.estado);
  const cancelable = !!o && (abierta || (o.estado === 'Completada' && !o.enGarantia));
  const trabajoVigente = !!o && (o.estado === 'Completada' || o.estado === 'Facturada') && vigente(o.garantiaTrabajo?.hasta);

  const chain: ChainItem[] = o
    ? [
        ...(o.solicitud
          ? [{ tipo: 'SOLICITUD' as const, id: o.solicitud.id, codigo: o.solicitud.codigo, onOpen: doc.canOpen({ tipo: 'SOLICITUD' }) ? () => doc.open({ tipo: 'SOLICITUD', ...o.solicitud! }) : undefined }]
          : []),
        { tipo: 'SERVICIO', id: o.id, codigo: o.codigo, actual: true },
        ...(o.factura && o.ventaId
          ? [{ tipo: 'VENTA' as const, id: o.ventaId, codigo: o.factura, onOpen: doc.canOpen({ tipo: 'VENTA' }) ? () => doc.open({ tipo: 'VENTA', id: o.ventaId!, codigo: o.factura! }) : undefined }]
          : []),
      ]
    : [];

  return (
    <Modal
      title={o ? `Orden de servicio ${o.codigo}` : 'Orden de servicio'}
      wide
      footer={
        <>
          {o && staff && cancelable && (
            <button className="b b-red" style={{ marginRight: 'auto' }} onClick={() => modal.open(<OrderActionModal orden={o} mode="cancel" desdeDetalle />)}>
              Cancelar orden
            </button>
          )}
          <CancelButton label="Cerrar" />
          {o && staff && trabajoVigente && can('customers:read') && (
            <button className="b b-out" onClick={() => modal.open(<ServiceOrderFormModal garantiaDe={o} />)}>
              <Icon name="shield-check" size={15} /> Reclamo en garantía
            </button>
          )}
          {o && staff && (o.estado === 'Registrada' || o.estado === 'Asignada') && (
            <button className={`b ${o.estado === 'Registrada' ? 'b-amber' : 'b-out'}`} disabled={!db.tecnicos.length} onClick={() => modal.open(<OrderActionModal orden={o} mode="assign" desdeDetalle />)}>
              {o.estado === 'Registrada' ? 'Asignar técnico' : 'Cambiar técnico'}
            </button>
          )}
          {o && canWrite && o.estado === 'Asignada' && (
            <button className="b b-amber" disabled={busy} onClick={iniciar}>
              Iniciar trabajo
            </button>
          )}
          {o && canWrite && o.estado === 'En proceso' && (
            <button className="b b-green" onClick={() => modal.open(<CompleteServiceModal orden={o} desdeDetalle />)}>
              Completar
            </button>
          )}
          {o && staff && o.estado === 'Completada' && !o.enGarantia && can('sales:read') && (
            <button className="b b-green" onClick={() => modal.open(<OrderActionModal orden={o} mode="invoice" desdeDetalle />)}>
              Facturar
            </button>
          )}
        </>
      }
    >
      {error ? (
        <ErrorState msg={error} onRetry={load} />
      ) : !o ? (
        <ViewLoader text="Cargando orden de servicio…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {canOpenRecord('cliente') ? (
                  <button type="button" className="link-btn" onClick={() => openRecord('cliente', o.cliId)}>
                    {o.cli}
                  </button>
                ) : (
                  o.cli
                )}
                {o.enGarantia && (
                  <Tag tone="t-blue">
                    <Icon name="shield-check" size={12} strokeWidth={2.4} /> En garantía · sin costo
                  </Tag>
                )}
              </div>
              <div className="doc-meta">
                Registrada {fmtDateTime(o.fecha)}
                {o.cliTel && ` · Tel. ${o.cliTel}`}
              </div>
              <div className="doc-meta">Técnico: {o.tecnicoId ? o.tecnico : 'sin asignar'}</div>
            </div>
            <EstadoTag estado={o.estado} />
          </div>

          <Flujo o={o} />

          {o.estado === 'Cancelada' && (
            <div className="note note-danger">
              <span className="ic">⛔</span>
              <div>
                Cancelada {fmtDateTime(o.canceladaEl)}
                {o.motivoCancelacion && (
                  <>
                    : <b>{o.motivoCancelacion}</b>
                  </>
                )}
              </div>
            </div>
          )}

          {o.cobertura && (
            <section className="opi-cov" aria-label="Cobertura de la garantía">
              <h4>
                <Icon name="shield-check" size={16} /> Qué cubre la garantía
              </h4>
              {o.cobertura.origen === 'Compra' ? (
                <p>
                  {canOpenRecord('producto') ? (
                    <button type="button" className="link-btn" onClick={() => openRecord('producto', (o.cobertura as { productoId: string }).productoId)}>
                      {o.cobertura.producto}
                    </button>
                  ) : (
                    <b>{o.cobertura.producto}</b>
                  )}{' '}
                  <span className="mono muted-sm">{o.cobertura.sku}</span>, comprado en{' '}
                  {doc.canOpen({ tipo: 'VENTA' }) ? (
                    <button type="button" className="link-btn mono" onClick={() => doc.open({ tipo: 'VENTA', id: (o.cobertura as { ventaId: string }).ventaId, codigo: (o.cobertura as { factura: string }).factura })}>
                      {o.cobertura.factura}
                    </button>
                  ) : (
                    <span className="mono">{o.cobertura.factura}</span>
                  )}{' '}
                  el {fmtDate(o.cobertura.fechaVenta)}
                  {o.cobertura.dias ? ` · garantía de ${plazoGarantia(o.cobertura.dias)}` : ''}.
                </p>
              ) : (
                <p>
                  Garantía del trabajo de{' '}
                  {o.cobertura.ordenId ? (
                    <button type="button" className="link-btn mono" onClick={() => openRecord('servicio', (o.cobertura as { ordenId: string }).ordenId)}>
                      {o.cobertura.codigo}
                    </button>
                  ) : (
                    <span className="mono">{o.cobertura.codigo}</span>
                  )}
                  : el cliente vuelve por la misma falla.
                </p>
              )}
              <p className="opi-cov-until">Cobertura {vigenciaTexto(o.cobertura.hasta)}.</p>
              <p className="muted-sm">El trabajo en garantía no se cobra: la orden termina al completarse, sin factura.</p>
            </section>
          )}

          <h4 className="section-title">Trabajo solicitado</h4>
          <p className="opi-text">{o.desc}</p>
          {o.notas && (
            <>
              <h4 className="section-title">Notas</h4>
              <p className="opi-text is-muted">{o.notas}</p>
            </>
          )}

          {o.garantiaTrabajo && (
            <>
              <h4 className="section-title">Garantía del trabajo realizado</h4>
              {o.garantiaTrabajo.dias > 0 ? (
                <p>
                  {plazoGarantia(o.garantiaTrabajo.dias)} desde que se completó: <b>{vigenciaTexto(o.garantiaTrabajo.hasta)}</b>.
                  {trabajoVigente && staff && ' Si la falla vuelve, registre el reclamo con «Reclamo en garantía» y no se cobra.'}
                </p>
              ) : (
                <p className="opi-text is-muted">El trabajo se entregó sin garantía.</p>
              )}
              {o.reclamos.length > 0 && (
                <p className="opi-claims">
                  Reclamos atendidos con esta garantía:{' '}
                  {o.reclamos.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ', '}
                      <button type="button" className="link-btn mono" onClick={() => openRecord('servicio', r.id)}>
                        {r.codigo}
                      </button>{' '}
                      ({r.estado.toLowerCase()})
                    </span>
                  ))}
                </p>
              )}
            </>
          )}

          <DocChain items={chain} />
        </>
      )}
    </Modal>
  );
}

/** Avance: Registrada → Asignada → En proceso → Completada → Facturada (o Sin costo, en garantía). */
function Flujo({ o }: { o: OrdenServicio }) {
  if (o.estado === 'Cancelada') return null;
  const etapas = [
    { t: 'Registrada', d: fmtDate(o.fecha) },
    { t: 'Asignada', d: o.tecnicoId ? o.tecnico : 'sin técnico' },
    { t: 'En proceso', d: o.inicio ? fmtDate(o.inicio) : 'inicio del trabajo' },
    { t: 'Completada', d: o.fin ? fmtDate(o.fin) : 'trabajo terminado' },
    o.enGarantia ? { t: 'Sin costo', d: 'en garantía' } : { t: 'Facturada', d: o.factura ?? 'se cobra' },
  ];
  const idx = ['Registrada', 'Asignada', 'En proceso', 'Completada', 'Facturada'].indexOf(o.estado);
  const cerrada = o.estado === 'Facturada' || (o.enGarantia && o.estado === 'Completada');
  return (
    <ol className="op-flow" aria-label="Avance de la orden">
      {etapas.map((e, i) => {
        const done = cerrada || i < idx;
        const now = !cerrada && i === idx;
        return (
          <li key={e.t} className={done ? 'done' : now ? 'now' : ''} aria-current={now ? 'step' : undefined}>
            {done ? '✓ ' : ''}
            {e.t}
            <small>{e.d}</small>
          </li>
        );
      })}
    </ol>
  );
}
