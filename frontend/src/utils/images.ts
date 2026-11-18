/* Fotografías de productos (mejora n.° 4).
   La API guarda las fotos subidas como "/api/v1/uploads/products/<archivo>"; las del catálogo
   del equipo son rutas del frontend ("/product-images/…") y también se aceptan URL http(s). */

const API_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

/** Dirección para <img>: si la API está en otro dominio (VITE_API_URL absoluta), se antepone. */
export function imageSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/api/v1/')) return API_URL + url.slice('/api/v1'.length);
  return url;
}

/** true si la foto la guarda la API (se puede quitar o reemplazar desde el formulario). */
export const isUploadedImage = (url?: string | null): boolean => !!url && url.startsWith('/api/v1/uploads/');

export const MAX_IMAGE_SIDE = 1200;
export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';

/**
 * Reduce la foto en el navegador antes de subirla (lado mayor ≤ 1200 px, WebP ~85 %; conserva la
 * transparencia), así una foto de celular de 4 MB viaja como ~150 KB. Si el navegador no puede
 * procesarla, se envía tal cual y el servidor aplica el límite de 2 MB.
 */
export async function shrinkImage(file: File, maxSide = MAX_IMAGE_SIDE): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 600 * 1024) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  // Sin soporte de WebP, el navegador entrega PNG (también válido).
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) return file;
  // Si había que achicarla se usa siempre la reducida; si no, solo si pesa menos.
  return scale < 1 || blob.size < file.size ? blob : file;
}
