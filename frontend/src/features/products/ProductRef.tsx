/* Nombre de producto con vista previa rápida (mejora n.° 34): foto, SKU, precio y existencias
   por ubicación, tomados de los datos ya cargados (no hace llamadas a la API). */
import type { ReactNode } from 'react';
import { ProductImage } from '../../components/common/ProductImage';
import { HoverPreview } from '../../components/preview/HoverPreview';
import { useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { money } from '../../utils/format';

export function ProductPreviewCard({ p }: { p: Producto }) {
  const estado = p.stock <= 0 ? { txt: 'Agotado', cls: 'is-red' } : p.stock <= p.stockMin ? { txt: 'Bajo mínimo', cls: 'is-amber' } : { txt: 'Disponible', cls: 'is-green' };
  return (
    <div className="hp-prod">
      <ProductImage src={p.imagen} size={72} fallback={p.ic} />
      <div className="hp-body">
        <b className="hp-title">{p.nombre}</b>
        <small className="mono">{p.sku}</small>
        <small>{[p.marca, p.categoria].filter(Boolean).join(' · ') || 'Sin marca ni categoría'}</small>
        <div className="hp-facts">
          <span>
            Precio <b>{p.precio > 0 ? money(p.precio) : '—'}</b>
          </span>
          <span>
            Stock <b>{p.stock}</b> <i className={`hp-dot ${estado.cls}`}>{estado.txt}</i>
          </span>
          <span className="muted-sm">
            bodega {p.stockBodega} · sucursal {p.stockSucursal} · mín. {p.stockMin}
          </span>
        </div>
        {!p.activo && <small className="muted-sm">Producto inactivo</small>}
      </div>
    </div>
  );
}

/** Envuelve el nombre (o un botón) con la tarjeta de vista previa del producto. */
export function ProductRef({ id, children }: { id: string; children: ReactNode }) {
  const { db } = useData();
  const p = db.productos.find((x) => x.id === id);
  if (!p) return <>{children}</>;
  return <HoverPreview render={() => <ProductPreviewCard p={p} />}>{children}</HoverPreview>;
}
