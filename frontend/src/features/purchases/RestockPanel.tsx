/* Panel de reabastecimiento (mejora n.° 2): convierte el stock crítico en una decisión de compra.
   El servidor sugiere cuánto pedir con una regla visible; la persona revisa, ajusta la cantidad
   y crea la compra al proveedor preferente sin volver a capturar los productos. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KpiCard } from '../../components/cards/KpiCard';
import { EmptyState } from '../../components/feedback/Empty';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import type { Moneda, ResumenReposicion, SugerenciaReposicion } from '../../types';
import { fmtDate, money } from '../../utils/format';
import { ProductFormModal } from '../products/ProductFormModal';
import { PostponeRestockModal } from './PostponeRestockModal';
import { PurchaseFormModal } from './PurchaseFormModal';
import { costIn } from './purchaseFormat';

interface Group {
  key: string;
  proveedorId: string | null;
  nombre: string;
  plazo: number | null;
  items: SugerenciaReposicion[];
}

const RELOAD_ON = new Set(['purchases', 'inventory', 'sales', 'products']);

export function RestockPanel() {
  const { db, sugerenciasReposicion, reactivarReposicion } = useData();
  const { can } = useAuth();
  const canWrite = can('purchases:write');
  const toast = useToast();
  const modal = useModal();
  const [verPospuestos, setVerPospuestos] = useState(false);
  const [data, setData] = useState<{ items: SugerenciaReposicion[]; resumen: ResumenReposicion } | null>(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const r = await sugerenciasReposicion(verPospuestos);
    if (!r.ok) return setError(r.error);
    setError('');
    setData(r.data);
    // Conserva lo que la persona ya ajustó; lo nuevo entra con la cantidad sugerida.
    setQty((prev) => Object.fromEntries(r.data.items.map((s) => [s.prod, prev[s.prod] ?? String(s.sugerido)])));
    setSel((prev) => Object.fromEntries(r.data.items.map((s) => [s.prod, prev[s.prod] ?? (s.sugerido > 0 && !s.pospuestoHasta)])));
  }, [sugerenciasReposicion, verPospuestos]);

  useEffect(() => {
    void load();
    const unsub = subscribeRealtime((e) => {
      if (!RELOAD_ON.has(e.module)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of data?.items ?? []) {
      const key = s.proveedor?.id ?? 'none';
      if (!map.has(key)) {
        map.set(key, { key, proveedorId: s.proveedor?.id ?? null, nombre: s.proveedor?.nombre ?? 'Sin proveedor preferente', plazo: s.proveedor?.plazo ?? null, items: [] });
      }
      map.get(key)!.items.push(s);
    }
    // Primero los grupos con proveedor; "sin proveedor" al final.
    return [...map.values()].sort((a, b) => (a.proveedorId ? 0 : 1) - (b.proveedorId ? 0 : 1) || a.nombre.localeCompare(b.nombre));
  }, [data]);

  const crearCompra = (g: Group) => {
    const elegidos = g.items.filter((s) => sel[s.prod] && Number(qty[s.prod]) > 0);
    if (!elegidos.length) return toast('Marque al menos un producto con cantidad mayor que cero', 'err');
    // Moneda: la del último costo del proveedor si todos coinciden; si no, córdobas.
    const monedas = new Set(elegidos.map((s) => s.proveedor?.moneda ?? 'NIO'));
    const moneda: Moneda = monedas.size === 1 ? ([...monedas][0] as Moneda) : 'NIO';
    modal.open(
      <PurchaseFormModal
        preset={{
          proveedorId: g.proveedorId ?? undefined,
          moneda,
          notas: 'Generada desde el panel de reabastecimiento',
          lineas: elegidos.map((s) => {
            // Costo propuesto: el último del proveedor si está en la misma moneda; si no, el promedio (C$).
            const ultimo = s.proveedor && s.proveedor.moneda === moneda ? s.proveedor.ultimoCosto : null;
            return {
              prod: s.prod,
              cant: Math.round(Number(qty[s.prod])),
              costo: ultimo ?? (moneda === 'NIO' ? s.costoProm : undefined),
            };
          }),
        }}
      />,
    );
  };

  const reactivar = async (s: SugerenciaReposicion) => {
    const r = await reactivarReposicion(s.prod);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${s.sku} vuelve al panel`, 'ok');
    void load();
  };

  if (error)
    return (
      <div className="card conn-error" role="alert">
        <h2>No se pudo calcular el reabastecimiento</h2>
        <p>{error}</p>
        <button className="b b-amber" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  if (!data) return <ViewLoader text="Calculando sugerencias de compra…" />;

  const r = data.resumen;
  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard lbl="En stock crítico" val={r.productos} sub={`${r.cubiertos} cubiertos por compras en camino`} ic="▼" tone={r.productos ? 'warn' : 'good'} />
        <KpiCard lbl="Por pedir" val={r.porPedir} sub={`${r.unidades} unidades sugeridas`} ic="⇩" />
        <KpiCard lbl="Costo estimado" val={money(r.costoEstimado)} sub="último costo o costo promedio" ic="◰" />
        <KpiCard lbl="Pospuestos" val={r.pospuestos} sub="no se muestran por ahora" ic="◷" />
      </div>

      <div className="toolbar">
        <div className="note" style={{ flex: 1, minWidth: 260 }}>
          <span className="ic">ℹ️</span>
          <div>
            Sugerido = objetivo − stock − lo que ya viene en camino. Objetivo: el <b>stock máximo</b> del producto o, si no lo tiene, el mayor entre <b>2 × mínimo</b> y <b>mínimo + ventas de {r.diasDemanda} días</b>. Ajuste la cantidad antes de crear la compra.
          </div>
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={verPospuestos} onChange={(e) => setVerPospuestos(e.target.checked)} />
          Mostrar pospuestos ({r.pospuestos})
        </label>
      </div>

      {!groups.length ? (
        <div className="card">
          <EmptyState msg="Ningún producto está en stock crítico. ¡Inventario saludable!" ic="✓" />
        </div>
      ) : (
        groups.map((g) => {
          const elegidos = g.items.filter((s) => sel[s.prod] && Number(qty[s.prod]) > 0);
          const estimado = elegidos.reduce((a, s) => a + Number(qty[s.prod]) * s.costoEstimado, 0);
          return (
            <section className="card restock-group" key={g.key} aria-label={`Proveedor ${g.nombre}`}>
              <div className="restock-group-h">
                <h3>
                  {g.nombre}
                  {g.plazo !== null && <span className="muted-sm"> · entrega en ~{g.plazo} días</span>}
                </h3>
                {canWrite && (
                  <button className="b b-amber b-sm" onClick={() => crearCompra(g)} disabled={!elegidos.length}>
                    Crear compra {g.proveedorId ? 'a este proveedor' : ''} ({elegidos.length})
                    {estimado > 0 && ` · ~${money(estimado)}`}
                  </button>
                )}
              </div>
              <div className="tablewrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      {canWrite && <th aria-label="Incluir en la compra" />}
                      <th>Producto</th>
                      <th className="num">Stock / mín. / máx.</th>
                      <th className="num">Ventas {r.diasDemanda} d</th>
                      <th className="num">Cobertura</th>
                      <th className="num">En camino</th>
                      <th className="num">Último costo</th>
                      <th className="num" style={{ width: 110 }}>
                        Pedir
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((s) => (
                      <tr key={s.prod} className={s.pospuestoHasta ? 'is-muted' : undefined}>
                        {canWrite && (
                          <td>
                            <input
                              type="checkbox"
                              checked={!!sel[s.prod]}
                              disabled={!!s.pospuestoHasta}
                              onChange={(e) => setSel((x) => ({ ...x, [s.prod]: e.target.checked }))}
                              aria-label={`Incluir ${s.sku} en la compra`}
                            />
                          </td>
                        )}
                        <td>
                          <div>
                            {s.agotado ? <Tag tone="t-red">✕ Agotado</Tag> : <Tag tone="t-amber">▼ Crítico</Tag>} <b>{s.prodN}</b>
                          </div>
                          <div className="muted-sm">
                            <span className="mono">{s.sku}</span>
                            {s.categoria && ` · ${s.categoria}`}
                          </div>
                          <div className="restock-rule" title="Cómo se calculó la sugerencia">
                            {s.explicacion}
                          </div>
                        </td>
                        <td className="num">
                          <b>{s.stock}</b> / {s.stockMin} / {s.stockMax ?? '—'}
                        </td>
                        <td className="num">{s.vendido30}</td>
                        <td className="num">{s.diasCobertura === null ? '—' : `${s.diasCobertura} d`}</td>
                        <td className="num">
                          {s.enCamino || '—'}
                          {s.enBorrador > 0 && <div className="muted-sm">{s.enBorrador} en borrador</div>}
                        </td>
                        <td className="num">
                          {s.proveedor && s.proveedor.ultimoCosto !== null && s.proveedor.moneda ? costIn(s.proveedor.ultimoCosto, s.proveedor.moneda) : '—'}
                        </td>
                        <td className="num">
                          {s.pospuestoHasta ? (
                            <span className="muted-sm">hasta {fmtDate(s.pospuestoHasta)}</span>
                          ) : s.cubierto ? (
                            <Tag tone="t-green">✓ En camino</Tag>
                          ) : (
                            <input
                              className="cell-input"
                              type="number"
                              min={0}
                              value={qty[s.prod] ?? ''}
                              onChange={(e) => setQty((x) => ({ ...x, [s.prod]: e.target.value }))}
                              aria-label={`Cantidad a pedir de ${s.sku}`}
                              disabled={!canWrite}
                            />
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.sinRegla && can('products:write') && (
                            <button
                              className="b b-out b-sm"
                              onClick={() => {
                                const p = db.productos.find((x) => x.id === s.prod);
                                if (p) modal.open(<ProductFormModal producto={p} />);
                              }}
                            >
                              Definir mín./máx.
                            </button>
                          )}{' '}
                          {canWrite &&
                            (s.pospuestoHasta ? (
                              <button className="b b-out b-sm" onClick={() => reactivar(s)}>
                                Reactivar
                              </button>
                            ) : (
                              <button className="b b-out b-sm" onClick={() => modal.open(<PostponeRestockModal sugerencia={s} onDone={load} />)}>
                                Posponer
                              </button>
                            ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
