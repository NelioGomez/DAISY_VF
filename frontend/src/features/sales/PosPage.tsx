/* VENTA TIPO POS (mejoras n.° 5, 6, 25 y 26 del análisis UX)
   Pantalla rápida: buscar por nombre o SKU (↑ ↓ y Enter), ver precio y existencia, ajustar
   cantidades, elegir la forma de pago con tarjetas y revisar un resumen con advertencias de
   stock antes de confirmar. El carrito se conserva si la venta falla o se cambia de pantalla. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyState } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { StockTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import { calcTotales } from '../../utils/documents';
import { matches, money } from '../../utils/format';
import { ProductDrawer } from '../products/ProductDrawer';
import { buildTerms, initialTerms, type TermsState } from './paymentTerms';
import { PaymentTermsFields } from './PaymentTermsFields';
import { SaleConfirmModal } from './SaleConfirmModal';
import { stockWarnings, type SummaryLine } from './stockWarnings';

interface CartItem {
  prod: string;
  cant: number;
}

interface SavedCart {
  cliId: string;
  cart: CartItem[];
}

function readCart(key: string): SavedCart | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedCart) : null;
  } catch {
    return null;
  }
}

export function PosPage() {
  const { db } = useData();
  const { can, user } = useAuth();
  const toast = useToast();
  const modal = useModal();
  const canSell = can('sales:write') && can('customers:read') && can('products:read');
  const storageKey = `siven.pos.${user?.id ?? ''}`;
  const [saved] = useState(() => readCart(storageKey));
  const [cliId, setCliId] = useState(saved?.cliId ?? '');
  const [cart, setCart] = useState<CartItem[]>(saved?.cart ?? []);
  const [terms, setTerms] = useState<TermsState>(initialTerms);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // El carrito sobrevive a recargar o cambiar de pantalla (solo en esta pestaña).
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ cliId, cart }));
    } catch {
      /* sin almacenamiento: el carrito vive solo en memoria */
    }
  }, [storageKey, cliId, cart]);

  const clientes = db.clientes.filter((c) => c.activo);
  const cliente = clientes.find((c) => c.id === cliId);
  // Solo productos activos con precio comercial (el servidor no vende sin precio).
  const vendibles = useMemo(() => db.productos.filter((p) => p.activo && p.precio > 0), [db.productos]);
  const categorias = useMemo(() => {
    const ids = new Set(vendibles.map((p) => p.categoriaId).filter(Boolean));
    return db.categorias.filter((c) => ids.has(c.id));
  }, [vendibles, db.categorias]);
  const results = vendibles.filter((p) => (!cat || p.categoriaId === cat) && matches(q, p.nombre, p.sku, p.marca, p.categoria)).slice(0, 40);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const lines: SummaryLine[] = cart.flatMap((l) => {
    const p = db.productos.find((x) => x.id === l.prod);
    if (!p) return [];
    return [{ prod: p.id, nombre: p.nombre, sku: p.sku, cant: l.cant, precio: p.precio, sub: Math.round(p.precio * l.cant * 100) / 100, stock: p.stock, min: p.stockMin }];
  });
  const totals = calcTotales(
    lines.reduce((a, l) => a + l.sub, 0),
    db.config.taxRate,
  );
  const warnings = stockWarnings(lines);
  const warnBy = new Map(warnings.map((w) => [w.sku, w]));
  const bloqueada = warnings.some((w) => w.tipo === 'falta');
  const unidades = lines.reduce((n, l) => n + l.cant, 0);

  const add = (id: string) => {
    const p = db.productos.find((x) => x.id === id);
    if (!p) return;
    const actual = cart.find((l) => l.prod === id)?.cant ?? 0;
    if (actual + 1 > p.stock) return toast(`${p.sku}: solo hay ${p.stock} disponibles`, 'err');
    setCart((c) => (c.some((l) => l.prod === id) ? c.map((l) => (l.prod === id ? { ...l, cant: l.cant + 1 } : l)) : [...c, { prod: id, cant: 1 }]));
  };
  const setCant = (id: string, n: number) =>
    setCart((c) => (n <= 0 ? c.filter((l) => l.prod !== id) : c.map((l) => (l.prod === id ? { ...l, cant: Math.min(n, 1_000_000) } : l))));

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      setActive(Math.min(activeIndex + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActive(Math.max(activeIndex - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter' && results[activeIndex]) {
      if (results[activeIndex].stock > 0) add(results[activeIndex].id);
      e.currentTarget.select();
      e.preventDefault();
    } else if (e.key === 'Escape' && q) {
      setQ('');
      e.stopPropagation();
    }
  };

  const vaciar = () => {
    setCart([]);
    setTerms(initialTerms());
  };

  const revisar = () => {
    if (!cliId || !cliente) return toast('Seleccione el cliente', 'err');
    if (!lines.length) return toast('Agregue al menos un producto', 'err');
    if (bloqueada) return toast('Hay productos sin existencia suficiente: ajuste las cantidades', 'err');
    const t = buildTerms(terms, totals.total);
    if (typeof t === 'string') return toast(t, 'err');
    modal.open(<SaleConfirmModal cliId={cliId} cliente={cliente.nombre} lines={lines} totals={totals} terms={t} onDone={vaciar} />);
  };

  if (!canSell)
    return (
      <div className="card">
        <EmptyState msg="Su rol no puede registrar ventas." ic="🔒" />
      </div>
    );

  return (
    <>
      <ViewHead
        title="Nueva venta"
        desc="Busque por nombre o SKU, agregue con Enter y revise el resumen antes de confirmar. El servidor valida el stock y genera la factura."
        actions={
          <Link to="/app/ventas" className="b b-out">
            ← Ventas
          </Link>
        }
      />
      <div className="pos">
        <section className="card pos-search" aria-label="Buscar productos">
          <div className="search">
            <input
              ref={searchRef}
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Buscar por nombre, SKU o marca…"
              aria-label="Buscar producto"
              aria-controls="pos-results"
            />
          </div>
          <div className="chips" role="group" aria-label="Filtrar por categoría">
            <button className={`chip ${!cat ? 'active' : ''}`} onClick={() => setCat('')} aria-pressed={!cat}>
              Todas
            </button>
            {categorias.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(cat === c.id ? '' : c.id)} aria-pressed={cat === c.id}>
                {c.nombre}
              </button>
            ))}
          </div>
          <p className="kbd-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> para moverse · <kbd>Enter</kbd> agrega una unidad · <kbd>Esc</kbd> limpia la búsqueda
          </p>
          <ul id="pos-results" className="pos-results" role="listbox" aria-label="Resultados">
            {!results.length && <li className="muted-sm">Ningún producto coincide.</li>}
            {results.map((p, i) => {
              const enCarrito = cart.find((l) => l.prod === p.id)?.cant ?? 0;
              return (
                <li key={p.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    className={`pos-item ${i === activeIndex ? 'active' : ''}`}
                    disabled={p.stock <= 0}
                    onClick={() => {
                      add(p.id);
                      searchRef.current?.focus();
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="pos-ic" aria-hidden="true">
                      {p.ic}
                    </span>
                    <span className="pos-name">
                      <b>{p.nombre}</b>
                      <span className="muted-sm">
                        <span className="mono">{p.sku}</span>
                        {p.marca && ` · ${p.marca}`}
                      </span>
                    </span>
                    <span className="pos-price">
                      <b className="mono">{money(p.precio)}</b>
                      <span>
                        <StockTag stock={p.stock - enCarrito} min={p.stockMin} /> <span className="mono muted-sm">{p.stock - enCarrito} disp.</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card pos-cart" aria-label="Venta en curso">
          <div className="field">
            <label htmlFor="pos-cliente">Cliente</label>
            <select id="pos-cliente" value={cliId} onChange={(e) => setCliId(e.target.value)}>
              <option value="">— Seleccione el cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.ruc ? ` · ${c.ruc}` : ''}
                </option>
              ))}
            </select>
            {cliente && cliente.saldo > 0 && <div className="help" style={{ color: 'var(--amber-deep)' }}>Saldo pendiente del cliente: {money(cliente.saldo)}</div>}
          </div>

          <div className="pos-lines">
            {!lines.length ? (
              <EmptyState msg="El carrito está vacío. Busque un producto y presione Enter." ic="🛒" />
            ) : (
              lines.map((l) => {
                const w = warnBy.get(l.sku);
                return (
                  <div className={`pos-line ${w?.tipo === 'falta' ? 'is-error' : w ? 'is-warn' : ''}`} key={l.prod}>
                    <div className="pos-line-main">
                      <button className="link-btn" onClick={() => modal.open(<ProductDrawer productoId={l.prod} />)}>
                        {l.nombre}
                      </button>
                      <div className="muted-sm">
                        <span className="mono">{l.sku}</span> · {money(l.precio)} c/u · disponible {l.stock}
                      </div>
                      {w && (
                        <div className="pos-warn" role={w.tipo === 'falta' ? 'alert' : undefined}>
                          {w.tipo === 'falta' ? '✕' : '▼'} {w.texto}
                        </div>
                      )}
                    </div>
                    <div className="stepper" role="group" aria-label={`Cantidad de ${l.sku}`}>
                      <button onClick={() => setCant(l.prod, l.cant - 1)} aria-label={`Quitar una unidad de ${l.sku}`}>
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.cant}
                        onChange={(e) => setCant(l.prod, Math.round(Number(e.target.value) || 0))}
                        aria-label={`Cantidad de ${l.sku}`}
                      />
                      <button onClick={() => add(l.prod)} aria-label={`Agregar una unidad de ${l.sku}`}>
                        +
                      </button>
                    </div>
                    <div className="pos-line-sub mono">{money(l.sub)}</div>
                    <button className="icon-btn pos-del" onClick={() => setCant(l.prod, 0)} aria-label={`Quitar ${l.sku} del carrito`}>
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="totbox" style={{ width: '100%' }}>
            <div className="r">
              <span>
                Subtotal · {unidades} u.
              </span>
              <span>{money(totals.sub)}</span>
            </div>
            {db.config.taxRate > 0 ? (
              <div className="r">
                <span>IVA ({Math.round(db.config.taxRate * 10000) / 100}%)</span>
                <span>{money(totals.iva)}</span>
              </div>
            ) : (
              <div className="r" style={{ color: 'var(--muted)', fontSize: 12 }}>
                <span>Régimen de cuota fija</span>
                <span>sin IVA</span>
              </div>
            )}
            <div className="r grand">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>

          <h4 className="section-title">Forma de pago</h4>
          <PaymentTermsFields value={terms} onChange={setTerms} total={totals.total} />

          <div className="pos-actions">
            <button className="b b-out" onClick={vaciar} disabled={!cart.length}>
              Vaciar
            </button>
            <button className="b b-amber pos-go" onClick={revisar} disabled={!lines.length || bloqueada}>
              Revisar y confirmar · {money(totals.total)}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
