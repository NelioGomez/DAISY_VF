/* Detalle de una solicitud web (registro auditable, mejora n.° 44) con la acción
   "Crear cotización" precargada (mejora n.° 45) y la cadena SOL › COT › FAC (n.° 50).
   Las acciones dependen del motivo (n.° 59): solo un pedido de precios se cotiza; un servicio
   técnico, una garantía o un reclamo se atiende con una orden de servicio (SOL › OPI, n.° 60);
   el motivo se puede corregir mientras la solicitud está abierta. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useCallback, useEffect, useState } from 'react';
import { DocChain, type ChainItem } from '../../components/common/DocChain';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import type { ConsultaWeb, EstadoConsulta, TipoConsulta } from '../../types';
import { ago, fmtDateTime, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { QuotationFormModal } from '../quotations/QuotationFormModal';
import { ServiceOrderFormModal } from '../service-orders/ServiceOrderFormModal';
import { TipoConsultaTag } from './TipoConsultaTag';
import { TIPOS_CONSULTA, etiquetaTipo } from './tiposConsulta';

export function InquiryDetailModal({ consultaId }: { consultaId: string }) {
  const { obtenerConsulta, cambiarEstadoConsulta, cambiarTipoConsulta } = useData();
  const { can, user } = useAuth();
  const canWrite = can('inquiries:write');
  const canService = can('service-orders:write') && can('customers:read') && user?.role !== 'tecnico';
  const canQuote = canWrite && can('quotations:write') && can('customers:read') && can('products:read');
  const toast = useToast();
  const modal = useModal();
  const doc = useOpenDocument();
  const [c, setC] = useState<ConsultaWeb | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void obtenerConsulta(consultaId).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setC(r.data);
        setError('');
      }
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [consultaId, obtenerConsulta, version]);

  // Si otro vendedor la toma o la cotiza mientras está abierta, se actualiza.
  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (e.module === 'quotations' || e.module === 'service-orders' || (e.module === 'inquiries' && (!e.entityId || e.entityId === consultaId))) load();
      }),
    [load, consultaId],
  );

  const cambiar = async (estado: EstadoConsulta) => {
    if (!c) return;
    setBusy(true);
    const r = await cambiarEstadoConsulta(c.id, estado);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c.codigo}: ${estado.toLowerCase()}`, 'ok');
    load();
  };

  const cambiarTipo = async (tipo: TipoConsulta) => {
    if (!c || tipo === c.tipo) return;
    setBusy(true);
    const r = await cambiarTipoConsulta(c.id, tipo);
    setBusy(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c.codigo}: motivo «${etiquetaTipo(tipo)}»`, 'ok');
    load();
  };

  const chain: ChainItem[] = c
    ? [
        { tipo: 'SOLICITUD', id: c.id, codigo: c.codigo, actual: true },
        ...(c.cotizacion
          ? [{ tipo: 'COTIZACION' as const, id: c.cotizacion.id, codigo: c.cotizacion.codigo, detalle: c.cotizacion.estado, onOpen: doc.canOpen({ tipo: 'COTIZACION' }) ? () => doc.open({ tipo: 'COTIZACION', id: c.cotizacion!.id, codigo: c.cotizacion!.codigo }) : undefined }]
          : []),
        ...(c.cotizacion?.factura
          ? [{ tipo: 'VENTA' as const, id: c.cotizacion.factura.id, codigo: c.cotizacion.factura.codigo, onOpen: doc.canOpen({ tipo: 'VENTA' }) ? () => doc.open({ tipo: 'VENTA', id: c.cotizacion!.factura!.id, codigo: c.cotizacion!.factura!.codigo }) : undefined }]
          : []),
        ...(c.ordenServicio
          ? [
              {
                tipo: 'SERVICIO' as const,
                id: c.ordenServicio.id,
                codigo: c.ordenServicio.codigo,
                detalle: c.ordenServicio.enGarantia ? `${c.ordenServicio.estado} · garantía` : c.ordenServicio.estado,
                onOpen: doc.canOpen({ tipo: 'SERVICIO' }) ? () => doc.open({ tipo: 'SERVICIO', id: c.ordenServicio!.id, codigo: c.ordenServicio!.codigo }) : undefined,
              },
            ]
          : []),
      ]
    : [];
  const abierta = !!c && (c.estado === 'Nueva' || c.estado === 'En revisión');
  const cotizable = !!c && abierta && !c.cotizacion && c.tipo === 'Cotización';
  // Servicio técnico, garantía o reclamo: se atiende con una orden de servicio (OPI).
  const atendible = !!c && abierta && !c.ordenServicio && (c.tipo === 'Servicio técnico' || c.tipo === 'Reclamo');
  // Una lista de productos siempre es un pedido de cotización: su motivo no se cambia.
  const motivoEditable = !!c && canWrite && abierta && !c.items.length;

  return (
    <Modal
      title={c ? `Solicitud ${c.codigo}` : 'Solicitud'}
      wide
      footer={
        <>
          {c && canWrite && (c.estado === 'Nueva' || c.estado === 'En revisión') && (
            <button className="b b-red" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => cambiar('Cancelada')} title="Spam, duplicada o datos falsos">
              Cancelar
            </button>
          )}
          <CancelButton label="Cerrar" />
          {c && canWrite && ['Nueva', 'En revisión', 'Cotizada'].includes(c.estado) && (
            <button className="b b-out" disabled={busy} onClick={() => cambiar('Cerrada')}>
              Cerrar solicitud
            </button>
          )}
          {c && canWrite && c.estado === 'Nueva' && (
            <button className="b b-out" disabled={busy} onClick={() => cambiar('En revisión')}>
              Tomar (en revisión)
            </button>
          )}
          {c && cotizable && canQuote && (
            <button className="b b-amber" onClick={() => modal.open(<QuotationFormModal solicitud={c} />)}>
              ▥ Crear cotización
            </button>
          )}
          {c && atendible && canService && (
            <button className="b b-amber" onClick={() => modal.open(<ServiceOrderFormModal solicitud={c} />)}>
              ⚒ Crear orden de servicio
            </button>
          )}
        </>
      }
    >
      {error ? (
        <ErrorState msg={error} onRetry={load} />
      ) : !c ? (
        <ViewLoader text="Cargando solicitud…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {c.nombre} <TipoConsultaTag tipo={c.tipo} /> {c.origen === 'PORTAL' ? <Tag tone="t-violet">Con cuenta del portal</Tag> : <Tag>Formulario web</Tag>}
              </div>
              <div className="doc-meta">
                Recibida {fmtDateTime(c.fecha)} · contacto: <span className="mono">{c.contacto}</span>
              </div>
              <div className="doc-meta">
                {c.estado} {ago(c.estadoDesde)}
                {c.asignado && ` · atendida por @${c.asignado}`}
                {c.cliente ? ` · cliente: ${c.cliente.nombre}` : ' · sin cliente vinculado'}
              </div>
            </div>
            <EstadoTag estado={c.estado} />
          </div>

          {motivoEditable && (
            <label className="inline-field">
              <span>Motivo</span>
              <select value={c.tipo} disabled={busy} onChange={(e) => void cambiarTipo(e.target.value as TipoConsulta)}>
                {TIPOS_CONSULTA.map((t) => (
                  <option key={t} value={t}>
                    {etiquetaTipo(t)}
                  </option>
                ))}
              </select>
              <small>Corríjalo si el cliente eligió otro (p. ej. escribió en «Otra consulta» pero pide precios).</small>
            </label>
          )}

          <DocChain items={chain} />

          {c.msg && (
            <blockquote className="quote-msg">
              <span className="sr-only">Mensaje: </span>
              {c.msg}
            </blockquote>
          )}

          {c.items.length ? (
            <div className="tablewrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto solicitado</th>
                    <th className="num">Cant.</th>
                    <th className="num">Disponible</th>
                    <th className="num">Precio vigente</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((i) => (
                    <tr key={i.prod}>
                      <td>
                        {i.prodN} <span className="mono muted-sm">{i.sku}</span>
                        {!i.activo && <Tag tone="t-red">Inactivo</Tag>}
                      </td>
                      <td className="num">{i.cant}</td>
                      <td className="num" style={i.stock < i.cant ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                        {i.stock}
                        {i.stock < i.cant && ' ▼'}
                      </td>
                      <td className="num">{i.precio > 0 ? money(i.precio) : '—'}</td>
                      <td>{i.nota || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            c.producto && (
              <p className="doc-meta" style={{ marginBottom: 12 }}>
                {c.tipo === 'Servicio técnico' ? 'Equipo o producto' : 'Producto de interés'}: <b>{c.producto}</b>
              </p>
            )
          )}

          {cotizable && (
            <div className="note">
              <span className="ic">ℹ️</span>
              <div>
                «Crear cotización» precarga {c.cliente ? 'el cliente' : 'el contacto'} y {c.items.length ? 'los productos solicitados' : 'el mensaje'}. La solicitud no se borra: queda como <b>Cotizada</b> y enlazada a la cotización.
              </div>
            </div>
          )}
          {abierta && c.tipo === 'Cuenta' && (
            <div className="note">
              <span className="ic">ℹ️</span>
              <div>
                El cliente puede cambiar su <b>correo de acceso</b> y su <b>contraseña</b> en <i>Mi perfil</i> del portal. Si pide corregir el nombre, el RUC o la
                dirección, actualice su ficha en Clientes, respóndale y cierre la solicitud.
              </div>
            </div>
          )}
          {atendible && (
            <div className="note">
              <span className="ic">ℹ️</span>
              <div>
                {c.tipo === 'Servicio técnico'
                  ? '«Crear orden de servicio» precarga el cliente y la falla. Si es una garantía, márquela «En garantía» y elija la compra que la cubre: el sistema revisa que siga vigente y el trabajo no se cobra.'
                  : 'Si el reclamo requiere revisar o rehacer un trabajo, atiéndalo con «Crear orden de servicio» (en garantía si el trabajo anterior la tiene). Si no, respóndale y cierre la solicitud.'}{' '}
                La solicitud queda <b>Cerrada</b> y enlazada a la orden.
              </div>
            </div>
          )}
          {abierta && c.tipo === 'Otra' && (
            <div className="note">
              <span className="ic">ℹ️</span>
              <div>Respóndale por el contacto indicado y cierre la solicitud: queda como evidencia de la atención.</div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
