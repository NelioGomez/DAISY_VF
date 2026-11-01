/* Panel lateral del proveedor (mejora n.° 33): contacto, indicadores de compra, productos que
   surte (con su código y último costo) y compras recientes, con enlace a cada documento. */
import { useEffect, useState } from 'react';
import { DocChip } from '../../components/common/DocChain';
import { ProductImage } from '../../components/common/ProductImage';
import { Tabs, type TabItem } from '../../components/common/Tabs';
import { EmptyState } from '../../components/feedback/Empty';
import { ErrorState } from '../../components/feedback/ErrorState';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { Drawer } from '../../components/modals/Drawer';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { api, errorMessage } from '../../services/api/client';
import { mapProveedor, PURCHASE_STATUS, type ApiPurchaseStatus } from '../../services/api/mappers';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import type { EstadoCompra, Moneda, Proveedor } from '../../types';
import { ago, fmtDate, money } from '../../utils/format';
import { useRecords } from '../records/records';
import { costIn, moneyIn } from '../purchases/purchaseFormat';
import { PurchaseFormModal } from '../purchases/PurchaseFormModal';
import { SupplierFormModal } from './SupplierFormModal';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
type Tab = 'resumen' | 'productos' | 'compras';

interface FichaProveedor {
  proveedor: Proveedor;
  stats: { compras: number; totalNio: number; abiertas: number; ultima: string | null } | null;
  productos: Array<{
    id: string;
    sku: string;
    nombre: string;
    imagen: string | null;
    stock: number;
    bajo: boolean;
    activo: boolean;
    codigoProveedor: string;
    ultimoCosto: number | null;
    moneda: Moneda;
    entregaDias: number | null;
    preferente: boolean;
  }>;
  compras: Array<{ id: string; codigo: string; estado: EstadoCompra; moneda: Moneda; total: number; fecha: string; esperada: string | null }> | null;
}

const toFicha = (d: Json): FichaProveedor => ({
  proveedor: mapProveedor(d.supplier),
  stats: d.stats
    ? { compras: Number(d.stats.purchases) || 0, totalNio: Number(d.stats.purchasedNio) || 0, abiertas: Number(d.stats.openOrders) || 0, ultima: d.stats.lastPurchaseAt ?? null }
    : null,
  productos: (d.products ?? []).map((p: Json) => ({
    id: String(p.id),
    sku: String(p.sku ?? ''),
    nombre: String(p.name ?? ''),
    imagen: p.imageUrl ?? null,
    stock: Number(p.stock) || 0,
    bajo: !!p.lowStock,
    activo: p.isActive !== false,
    codigoProveedor: String(p.supplierSku ?? ''),
    ultimoCosto: p.lastCost === null || p.lastCost === undefined ? null : Number(p.lastCost),
    moneda: p.currency === 'USD' ? 'USD' : 'NIO',
    entregaDias: p.leadTimeDays ?? null,
    preferente: !!p.isPreferred,
  })),
  compras:
    d.purchases?.map((c: Json) => ({
      id: String(c.id),
      codigo: String(c.code),
      estado: PURCHASE_STATUS[c.status as ApiPurchaseStatus] ?? 'Borrador',
      moneda: c.currency === 'USD' ? 'USD' : 'NIO',
      total: Number(c.total) || 0,
      fecha: String(c.createdAt),
      esperada: c.expectedAt ?? null,
    })) ?? null,
});

export function SupplierDrawer({ proveedorId }: { proveedorId: string }) {
  const { can } = useAuth();
  const { db } = useData();
  const modal = useModal();
  const { openRecord } = useRecords();
  const [state, setState] = useState<{ id: string; ficha: FichaProveedor } | { id: string; error: string } | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get<Json>(`/suppliers/${proveedorId}/summary`)
      .then((d) => alive && setState({ id: proveedorId, ficha: toFicha(d) }))
      .catch((e) => alive && setState({ id: proveedorId, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [proveedorId, version]);

  // Se actualiza sola si cambian las compras o el proveedor mientras está abierta.
  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (['purchases', 'suppliers', 'products'].includes(e.module)) setVersion((v) => v + 1);
      }),
    [],
  );

  const current = state && state.id === proveedorId ? state : null;

  if (!current)
    return (
      <Drawer title="Proveedor">
        <ViewLoader text="Cargando proveedor…" />
      </Drawer>
    );
  if ('error' in current)
    return (
      <Drawer title="Proveedor">
        <ErrorState msg={current.error} onRetry={() => setVersion((n) => n + 1)} />
      </Drawer>
    );

  const f = current.ficha;
  const p = f.proveedor;
  const enStore = db.proveedores.find((x) => x.id === p.id) ?? p;
  const tabs: TabItem<Tab>[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'productos', label: 'Productos', count: f.productos.length },
    ...(f.compras ? [{ id: 'compras' as const, label: 'Compras', count: f.stats?.compras ?? f.compras.length }] : []),
  ];

  return (
    <Drawer
      title={p.nombre}
      subtitle={
        <>
          {p.ruc && <span className="mono">{p.ruc}</span>}
          {p.pais && `${p.ruc ? ' · ' : ''}${p.pais}`}
          {!p.activo && ' · Inactivo'}
        </>
      }
      footer={
        <>
          {can('suppliers:write') && (
            <button className="b b-out b-sm" onClick={() => modal.open(<SupplierFormModal proveedor={enStore} />)}>
              Editar
            </button>
          )}
          {can('purchases:write') && p.activo && (
            <button className="b b-amber b-sm" onClick={() => modal.open(<PurchaseFormModal preset={{ proveedorId: p.id, lineas: [] }} />)}>
              Nueva compra
            </button>
          )}
        </>
      }
    >
      <Tabs<Tab> label="Secciones del proveedor" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'resumen' && (
        <div className="drawer-section">
          {f.stats && (
            <div className="mini-kpis">
              <div>
                <span>Compras</span>
                <b>{f.stats.compras}</b>
                <small>{f.stats.abiertas ? `${f.stats.abiertas} por recibir` : 'ninguna por recibir'}</small>
              </div>
              <div>
                <span>Total comprado</span>
                <b>{money(f.stats.totalNio)}</b>
                <small>en córdobas, sin anuladas</small>
              </div>
              <div>
                <span>Última compra</span>
                <b>{f.stats.ultima ? fmtDate(f.stats.ultima) : '—'}</b>
                <small>{f.stats.ultima ? ago(f.stats.ultima) : 'sin compras'}</small>
              </div>
            </div>
          )}
          <dl className="facts" style={{ marginTop: 14 }}>
            <dt>Contacto</dt>
            <dd>{p.contacto || '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{p.tel ? <a href={`tel:${p.tel.replace(/\s+/g, '')}`}>{p.tel}</a> : '—'}</dd>
            <dt>Correo</dt>
            <dd>{p.correo ? <a href={`mailto:${p.correo}`}>{p.correo}</a> : '—'}</dd>
            <dt>Dirección</dt>
            <dd>{p.dir || '—'}</dd>
            <dt>Origen</dt>
            <dd>{p.internacional ? `Internacional${p.pais ? ` (${p.pais})` : ''}` : 'Nacional'}</dd>
          </dl>
        </div>
      )}

      {tab === 'productos' &&
        (f.productos.length ? (
          <ul className="rec-list">
            {f.productos.map((x) => (
              <li key={x.id}>
                <button type="button" className="rec-item" onClick={() => openRecord('producto', x.id)}>
                  <ProductImage src={x.imagen} size={36} />
                  <span className="rec-main">
                    <b>{x.nombre}</b>
                    <small>
                      <span className="mono">{x.sku}</span>
                      {x.codigoProveedor && ` · cód. proveedor ${x.codigoProveedor}`}
                      {x.entregaDias !== null && ` · entrega ${x.entregaDias} d`}
                    </small>
                  </span>
                  <span className="rec-side">
                    {x.preferente && <Tag tone="t-blue">Preferente</Tag>}
                    {x.ultimoCosto !== null && <small>{costIn(x.ultimoCosto, x.moneda)}</small>}
                    <small className={x.bajo ? 'txt-red' : ''}>Stock {x.stock}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState ic="▣" msg="Aún no hay productos asociados. Se asocian al registrar compras o desde la ficha del producto." />
        ))}

      {tab === 'compras' &&
        f.compras &&
        (f.compras.length ? (
          <ul className="plain-list">
            {f.compras.map((c) => (
              <li key={c.id} className="rec-row">
                <DocChip tipo="COMPRA" codigo={c.codigo} detalle={fmtDate(c.fecha)} onOpen={() => openRecord('compra', c.id)} />
                <span className="rec-side">
                  <EstadoTag estado={c.estado} />
                  <b>{moneyIn(c.total, c.moneda)}</b>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState ic="⇩" msg="Sin compras a este proveedor." />
        ))}
    </Drawer>
  );
}
