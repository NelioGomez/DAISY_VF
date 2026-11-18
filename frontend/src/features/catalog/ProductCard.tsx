import { Tag } from '../../components/tables/Tag';
import type { Producto } from '../../types';
import { money } from '../../utils/format';

interface ProductCardProps {
  producto: Producto;
  /** "internal": vista previa en el panel. "public": catálogo del sitio con botón Solicitar. */
  variant: 'internal' | 'public';
  onRequest?(p: Producto): void;
}

export function ProductCard({ producto: p, variant, onRequest }: ProductCardProps) {
  const disponible = p.stock > 0;
  return (
    <div className="prod-card">
      <div className="img">
        {p.ic}
        <span className="cat">{p.categoria}</span>
      </div>
      <div className="bd">
        <b>{p.nombre}</b>
        <div className="mk">{variant === 'internal' ? `${p.marca} · ${p.sku}` : p.marca}</div>
        <div className="pr">{money(p.precio)}</div>
        <div className="av">
          {disponible ? <Tag tone="t-green">Disponible</Tag> : variant === 'internal' ? <Tag tone="t-red">Agotado</Tag> : <Tag tone="t-amber">Bajo pedido</Tag>}
        </div>
        {variant === 'public' && (
          <button className="b b-out b-sm" style={{ marginTop: 10 }} onClick={() => onRequest?.(p)}>
            Solicitar
          </button>
        )}
      </div>
    </div>
  );
}
