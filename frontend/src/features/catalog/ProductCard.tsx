import { ProductImage } from '../../components/common/ProductImage';
import { Tag, type TagTone } from '../../components/tables/Tag';
import { money } from '../../utils/format';

export type Disponibilidad = 'Disponible' | 'Pocas unidades' | 'Agotado' | 'Bajo pedido';

export interface CatalogItem {
  id: string;
  nombre: string;
  marca: string;
  sku: string;
  categoria: string;
  precio: number;
  ic: string;
  /** Foto del producto (mejora n.° 4); '' = ícono de la categoría. */
  imagen: string;
  disponibilidad: Disponibilidad;
}

const TONE: Record<Disponibilidad, TagTone> = { Disponible: 't-green', 'Pocas unidades': 't-amber', Agotado: 't-red', 'Bajo pedido': 't-amber' };

interface ProductCardProps {
  item: CatalogItem;
  /** Vista previa del catálogo dentro del panel interno (el sitio público usa features/public). */
  variant: 'internal';
}

export function ProductCard({ item }: ProductCardProps) {
  return (
    <div className="prod-card">
      <div className="img">
        {item.imagen ? <ProductImage src={item.imagen} size={120} fallback={item.ic} alt={item.nombre} className="prod-card-photo" /> : item.ic}
        <span className="cat">{item.categoria || 'Sin categoría'}</span>
      </div>
      <div className="bd">
        <b>{item.nombre}</b>
        <div className="mk">
          {item.marca} · {item.sku}
        </div>
        <div className="pr">{money(item.precio)}</div>
        <div className="av">
          <Tag tone={TONE[item.disponibilidad]}>{item.disponibilidad}</Tag>
        </div>
      </div>
    </div>
  );
}
