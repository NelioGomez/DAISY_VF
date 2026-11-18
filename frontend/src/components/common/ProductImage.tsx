/* Foto del producto (mejora n.° 4): la imagen real si existe; si no hay o no carga, el ícono
   de su categoría. Se usa en listas, panel lateral, punto de venta, búsqueda y vista previa. */
import { useState, type ReactNode } from 'react';
import { imageSrc } from '../../utils/images';

interface ProductImageProps {
  src?: string | null;
  /** Texto alternativo; vacío si el nombre del producto ya está al lado. */
  alt?: string;
  size?: number;
  fallback?: ReactNode;
  className?: string;
}

export function ProductImage({ src, alt = '', size = 34, fallback = '▣', className = '' }: ProductImageProps) {
  const url = imageSrc(src);
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!url && failed !== url;
  return (
    <span className={`pimg ${show ? '' : 'is-empty'} ${className}`} style={{ width: size, height: size }}>
      {show ? (
        <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(url)} />
      ) : (
        <span className="pimg-fb" aria-hidden="true" style={{ fontSize: Math.round(size * 0.48) }}>
          {fallback}
        </span>
      )}
    </span>
  );
}
