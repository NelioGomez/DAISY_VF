/* Editor de líneas compartido por Cotizaciones y Ventas. */
import { IVA } from '../../config/business';
import { useData } from '../../store/hooks';
import type { CartLine } from '../../types';
import { cartTotals } from '../../utils/documents';
import { money } from '../../utils/format';

interface LineEditorProps {
  lines: CartLine[];
  onChange(lines: CartLine[]): void;
}

export function LineEditor({ lines, onChange }: LineEditorProps) {
  const { db } = useData();
  const activos = db.productos.filter((p) => p.activo);
  const t = cartTotals(db.productos, lines);

  const setLine = (i: number, patch: Partial<CartLine>) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
  const addLine = () => onChange([...lines, { prod: '', cant: 1 }]);

  return (
    <>
      <div className="li-head">
        <span>Producto</span>
        <span>Cant.</span>
        <span>Precio</span>
        <span>Subtotal</span>
        <span />
      </div>
      <div>
        {lines.map((l, i) => {
          const p = db.productos.find((x) => x.id === l.prod);
          const precio = p ? p.precio : 0;
          return (
            <div className="li-row" key={i}>
              <select value={l.prod} onChange={(e) => setLine(i, { prod: e.target.value })} aria-label="Producto">
                <option value="">— producto —</option>
                {activos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre} ({x.sku})
                  </option>
                ))}
              </select>
              <input type="number" min={1} value={l.cant || 1} onChange={(e) => setLine(i, { cant: +e.target.value })} aria-label="Cantidad" />
              <input value={money(precio)} disabled aria-label="Precio" />
              <input value={money(precio * (l.cant || 0))} disabled aria-label="Subtotal" />
              <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => delLine(i)} aria-label="Quitar línea">
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button className="b b-out b-sm" style={{ marginTop: 6 }} onClick={addLine}>
        + Agregar producto
      </button>
      <div className="totbox">
        <div className="r">
          <span>Subtotal</span>
          <span>{money(t.sub)}</span>
        </div>
        <div className="r">
          <span>IVA ({Math.round(IVA * 100)}%)</span>
          <span>{money(t.iva)}</span>
        </div>
        <div className="r grand">
          <span>Total</span>
          <span>{money(t.total)}</span>
        </div>
      </div>
    </>
  );
}
