import { EmptyState } from '../../components/feedback/Empty';
import { EstadoTag } from '../../components/tables/Tag';
import type { Producto, Venta } from '../../types';
import { money } from '../../utils/format';

export function MiniVentas({ ventas }: { ventas: Venta[] }) {
  const rows = ventas.slice(-5).reverse();
  if (!rows.length) return <EmptyState msg="Sin ventas" />;
  return (
    <div className="tablewrap" style={{ border: 'none' }}>
      <table>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="mono">{v.factura}</td>
              <td>{v.cliN}</td>
              <td className="num">{money(v.total)}</td>
              <td>
                <EstadoTag estado={v.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniCritico({ productos }: { productos: Producto[] }) {
  if (!productos.length) return <EmptyState msg="Inventario saludable" ic="✓" />;
  return (
    <div className="tablewrap" style={{ border: 'none' }}>
      <table>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>
                {p.ic} {p.nombre}
              </td>
              <td className="mono">{p.sku}</td>
              <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                {p.stock} / {p.stockMin}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
