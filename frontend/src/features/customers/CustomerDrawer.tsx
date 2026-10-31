/* Perfil 360° del cliente (mejora n.° 13) en panel lateral (n.° 33): contacto, indicadores y
   pestañas de ventas, cotizaciones, solicitudes, pagos y OPI, con acciones según el rol. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocChip } from '../../components/common/DocChain';
import { Tabs, type TabItem } from '../../components/common/Tabs';
import { EmptyState } from '../../components/feedback/Empty';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { Drawer } from '../../components/modals/Drawer';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { api, errorMessage } from '../../services/api/client';
import {
  INQUIRY_STATUS,
  METHOD_FROM_API,
  ORDER_STATUS,
  PAYMENT_STATUS,
  QUOTATION_STATUS,
  type ApiInquiryStatus,
  type ApiPaymentMethod,
  type ApiPaymentStatus,
  type ApiQuotationStatus,
  type ApiServiceOrderStatus,
} from '../../services/api/mappers';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import { ago, fmtDate, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { QuotationFormModal } from '../quotations/QuotationFormModal';
import { CustomerFormModal } from './CustomerFormModal';

type Tab = 'resumen' | 'ventas' | 'cotizaciones' | 'solicitudes' | 'pagos' | 'ordenes';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

interface Ficha {
  cliente: { id: string; nombre: string; ruc: string; contacto: string; tel: string; correo: string; dir: string; activo: boolean };
  stats: { ventas: number; total: number; saldo: number; vencidas: number; saldoVencido: number; ultima: string | null; ticket: number };
  portal: { correo: string; desde: string; ultimoIngreso: string | null; activa: boolean } | null;
  ventas: Array<{ id: string; codigo: string; fecha: string; vence: string | null; total: number; saldo: number; estado: string }> | null;
  cotizaciones: Array<{ id: string; codigo: string; fecha: string; validaHasta: string; total: number; estado: string }> | null;
  solicitudes: Array<{ id: string; codigo: string; fecha: string; items: number; estado: string }> | null;
  pagos: Array<{ id: string; fecha: string; monto: number; metodo: string; referencia: string; venta: { id: string; codigo: string } }> | null;
  ordenes: Array<{ id: string; codigo: string; fecha: string; estado: string; descripcion: string }> | null;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const toFicha = (d: Json): Ficha => ({
  cliente: {
    id: s(d.customer.id),
    nombre: s(d.customer.name),
    ruc: s(d.customer.ruc),
    contacto: s(d.customer.contactName),
    tel: s(d.customer.phone),
    correo: s(d.customer.email),
    dir: s(d.customer.address),
    activo: d.customer.isActive !== false,
  },
  stats: {
    ventas: Number(d.stats.salesCount) || 0,
    total: Number(d.stats.totalPurchases) || 0,
    saldo: Number(d.stats.pendingBalance) || 0,
    vencidas: Number(d.stats.overdueInvoices) || 0,
    saldoVencido: Number(d.stats.overdueBalance) || 0,
    ultima: d.stats.lastPurchaseAt ?? null,
    ticket: Number(d.stats.averageTicket) || 0,
  },
  portal: d.portalAccount ? { correo: s(d.portalAccount.email), desde: s(d.portalAccount.createdAt), ultimoIngreso: d.portalAccount.lastLoginAt ?? null, activa: !!d.portalAccount.isActive } : null,
  ventas:
    d.sales?.map((x: Json) => ({
      id: s(x.id),
      codigo: s(x.invoiceNumber),
      fecha: s(x.soldAt),
      vence: x.dueDate ?? null,
      total: Number(x.total) || 0,
      saldo: Number(x.balance) || 0,
      estado: x.status === 'VOIDED' ? 'Anulada' : (PAYMENT_STATUS[x.paymentStatus as ApiPaymentStatus] ?? 'Pendiente'),
    })) ?? null,
  cotizaciones:
    d.quotations?.map((x: Json) => ({
      id: s(x.id),
      codigo: s(x.code),
      fecha: s(x.issuedAt),
      validaHasta: s(x.validUntil),
      total: Number(x.total) || 0,
      estado: QUOTATION_STATUS[x.status as ApiQuotationStatus] ?? 'Pendiente',
    })) ?? null,
  solicitudes:
    d.inquiries?.map((x: Json) => ({ id: s(x.id), codigo: s(x.code), fecha: s(x.createdAt), items: Number(x.items) || 0, estado: INQUIRY_STATUS[x.status as ApiInquiryStatus] ?? 'Nueva' })) ?? null,
  pagos:
    d.payments?.map((x: Json) => ({
      id: s(x.id),
      fecha: s(x.paidAt),
      monto: Number(x.amount) || 0,
      metodo: METHOD_FROM_API[x.method as ApiPaymentMethod] ?? s(x.method),
      referencia: s(x.reference),
      venta: { id: s(x.sale?.id), codigo: s(x.sale?.invoiceNumber) },
    })) ?? null,
  ordenes:
    d.serviceOrders?.map((x: Json) => ({
      id: s(x.id),
      codigo: s(x.code),
      fecha: s(x.registeredAt),
      estado: ORDER_STATUS[x.status as ApiServiceOrderStatus] ?? s(x.status),
      descripcion: s(x.description),
    })) ?? null,
});

export function CustomerDrawer({ clienteId }: { clienteId: string }) {
  const { can } = useAuth();
  const { db } = useData();
  const modal = useModal();
  const navigate = useNavigate();
  const doc = useOpenDocument();
  const [state, setState] = useState<{ id: string; ficha: Ficha } | { id: string; error: string } | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get<Json>(`/customers/${clienteId}/summary`)
      .then((d) => alive && setState({ id: clienteId, ficha: toFicha(d) }))
      .catch((e) => alive && setState({ id: clienteId, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [clienteId, version]);

  // Se actualiza sola si alguien vende, cobra o cotiza a este cliente mientras está abierta.
  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (['sales', 'payments', 'quotations', 'inquiries', 'customers', 'service-orders'].includes(e.module)) setVersion((v) => v + 1);
      }),
    [],
  );

  const current = state && state.id === clienteId ? state : null;
  if (!current)
    return (
      <Drawer title="Cliente">
        <ViewLoader text="Cargando perfil…" />
      </Drawer>
    );
  if ('error' in current)
    return (
      <Drawer title="Cliente">
        <ErrorState msg={current.error} onRetry={() => setVersion((n) => n + 1)} />
      </Drawer>
    );

  const f = current.ficha;
  const c = f.cliente;
  const clienteStore = db.clientes.find((x) => x.id === c.id);
  const tabs: TabItem<Tab>[] = [
    { id: 'resumen', label: 'Resumen' },
    ...(f.ventas ? [{ id: 'ventas' as const, label: 'Ventas', count: f.stats.ventas }] : []),
    ...(f.cotizaciones ? [{ id: 'cotizaciones' as const, label: 'Cotizaciones', count: f.cotizaciones.length }] : []),
    ...(f.solicitudes ? [{ id: 'solicitudes' as const, label: 'Solicitudes', count: f.solicitudes.length }] : []),
    ...(f.pagos ? [{ id: 'pagos' as const, label: 'Pagos', count: f.pagos.length }] : []),
    ...(f.ordenes ? [{ id: 'ordenes' as const, label: 'OPI', count: f.ordenes.length }] : []),
  ];

  return (
    <Drawer
      title={c.nombre}
      subtitle={
        <>
          {c.ruc && <span className="mono">{c.ruc}</span>}
          {c.contacto && `${c.ruc ? ' · ' : ''}${c.contacto}`}
          {c.tel && ` · ${c.tel}`}
        </>
      }
      footer={
        <>
          {can('payments:write') && f.stats.saldo > 0 && (
            <button
              className="b b-out b-sm"
              onClick={() => {
                modal.close();
                navigate('/app/pagos');
              }}
            >
              Registrar pago
            </button>
          )}
          {can('quotations:write') && c.activo && (
            <button className="b b-out b-sm" onClick={() => modal.open(<QuotationFormModal clienteId={c.id} />)}>
              Nueva cotización
            </button>
          )}
          {can('sales:write') && c.activo && (
            <button
              className="b b-amber b-sm"
              onClick={() => {
                modal.close();
                navigate(`/app/ventas/nueva?cliente=${c.id}`);
              }}
            >
              Nueva venta
            </button>
          )}
          {can('customers:write') && clienteStore && (
            <button className="b b-out b-sm" onClick={() => modal.open(<CustomerFormModal cliente={clienteStore} />)}>
              Editar
            </button>
          )}
        </>
      }
    >
      <div className="tag-row">
        {!c.activo && <Tag tone="t-gray">Inactivo</Tag>}
        {f.stats.vencidas > 0 && (
          <Tag tone="t-red">
            <span aria-hidden="true">◷</span> {f.stats.vencidas} factura(s) vencida(s)
          </Tag>
        )}
        {f.portal && (
          <Tag tone="t-blue">
            <span aria-hidden="true">◉</span> Cuenta en el portal
          </Tag>
        )}
      </div>

      <div className="mini-kpis">
        <div>
          <span>Total comprado</span>
          <b>{money(f.stats.total)}</b>
          <small>
            {f.stats.ventas} {f.stats.ventas === 1 ? 'factura' : 'facturas'}
          </small>
        </div>
        <div>
          <span>Saldo pendiente</span>
          <b style={f.stats.saldo > 0 ? { color: 'var(--red)' } : undefined}>{money(f.stats.saldo)}</b>
          <small>{f.stats.saldoVencido > 0 ? `vencido ${money(f.stats.saldoVencido)}` : 'sin saldo vencido'}</small>
        </div>
        <div>
          <span>Última compra</span>
          <b>{f.stats.ultima ? fmtDate(f.stats.ultima) : '—'}</b>
          <small>{f.stats.ultima ? `${ago(f.stats.ultima)} · ticket ${money(f.stats.ticket)}` : 'aún no compra'}</small>
        </div>
      </div>

      <Tabs<Tab> label="Secciones del perfil" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'resumen' && (
        <div className="drawer-section">
          <dl className="facts">
            <dt>Persona de contacto</dt>
            <dd>{c.contacto || '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{c.tel || '—'}</dd>
            <dt>Correo</dt>
            <dd>{c.correo ? <a href={`mailto:${c.correo}`}>{c.correo}</a> : '—'}</dd>
            <dt>Dirección</dt>
            <dd>{c.dir || '—'}</dd>
            <dt>Portal de clientes</dt>
            <dd>
              {f.portal
                ? `${f.portal.correo} · desde ${fmtDate(f.portal.desde)}${f.portal.ultimoIngreso ? ` · último ingreso ${ago(f.portal.ultimoIngreso)}` : ''}`
                : 'Sin cuenta en el portal'}
            </dd>
          </dl>
        </div>
      )}

      {tab === 'ventas' && f.ventas && (
        <Lista vacio="Sin ventas" ic="⛽">
          {f.ventas.map((v) => (
            <tr key={v.id}>
              <td>
                <DocChip tipo="VENTA" codigo={v.codigo} onOpen={() => doc.open({ tipo: 'VENTA', id: v.id, codigo: v.codigo })} />
              </td>
              <td>{fmtDate(v.fecha)}</td>
              <td className="num">{money(v.total)}</td>
              <td className="num" style={v.saldo > 0 ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                {v.saldo > 0 ? money(v.saldo) : '—'}
              </td>
              <td>
                <EstadoTag estado={v.estado} />
              </td>
            </tr>
          ))}
        </Lista>
      )}

      {tab === 'cotizaciones' && f.cotizaciones && (
        <Lista vacio="Sin cotizaciones" ic="▥">
          {f.cotizaciones.map((q) => (
            <tr key={q.id}>
              <td>
                <DocChip tipo="COTIZACION" codigo={q.codigo} onOpen={() => doc.open({ tipo: 'COTIZACION', id: q.id, codigo: q.codigo })} />
              </td>
              <td>{fmtDate(q.fecha)}</td>
              <td className="num">{money(q.total)}</td>
              <td className="muted-sm">vence {fmtDate(q.validaHasta)}</td>
              <td>
                <EstadoTag estado={q.estado} />
              </td>
            </tr>
          ))}
        </Lista>
      )}

      {tab === 'solicitudes' && f.solicitudes && (
        <Lista vacio="Sin solicitudes web" ic="✉">
          {f.solicitudes.map((x) => (
            <tr key={x.id}>
              <td>
                <DocChip tipo="SOLICITUD" codigo={x.codigo} onOpen={() => doc.open({ tipo: 'SOLICITUD', id: x.id, codigo: x.codigo })} />
              </td>
              <td>{fmtDate(x.fecha)}</td>
              <td className="muted-sm">
                {x.items} {x.items === 1 ? 'producto' : 'productos'}
              </td>
              <td>
                <EstadoTag estado={x.estado} />
              </td>
            </tr>
          ))}
        </Lista>
      )}

      {tab === 'pagos' && f.pagos && (
        <Lista vacio="Sin pagos registrados" ic="◷">
          {f.pagos.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.fecha)}</td>
              <td className="num">{money(p.monto)}</td>
              <td>{p.metodo}</td>
              <td>
                <DocChip tipo="VENTA" codigo={p.venta.codigo} onOpen={() => doc.open({ tipo: 'VENTA', id: p.venta.id, codigo: p.venta.codigo })} />
              </td>
              <td className="muted-sm">{p.referencia}</td>
            </tr>
          ))}
        </Lista>
      )}

      {tab === 'ordenes' && f.ordenes && (
        <Lista vacio="Sin órdenes de servicio" ic="▩">
          {f.ordenes.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.codigo}</td>
              <td>{fmtDate(o.fecha)}</td>
              <td>{o.descripcion}</td>
              <td>
                <EstadoTag estado={o.estado} />
              </td>
            </tr>
          ))}
        </Lista>
      )}
    </Drawer>
  );
}

function Lista({ children, vacio, ic }: { children: ReactNode[]; vacio: string; ic: string }) {
  if (!children.length)
    return (
      <div className="drawer-section">
        <EmptyState msg={vacio} ic={ic} />
      </div>
    );
  return (
    <div className="drawer-section">
      <div className="tablewrap" style={{ border: 'none' }}>
        <table>
          <tbody>{children}</tbody>
        </table>
      </div>
      {children.length >= 10 && <p className="muted-sm">Se muestran los 10 más recientes.</p>}
    </div>
  );
}
