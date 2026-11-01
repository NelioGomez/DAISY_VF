/* Fotografías de productos (mejora n.° 4).
   Las fotos subidas se guardan en disco (UPLOADS_DIR/products, por defecto backend/uploads) y la
   API las sirve como archivos estáticos en /api/v1/uploads/products/<archivo>. En la BD solo queda
   la ruta (products.image_url). El tipo se reconoce por los primeros bytes del archivo, no por el
   nombre ni por lo que diga el navegador, y el nombre lo genera el servidor. */
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const UPLOADS_PREFIX = '/api/v1/uploads/';
export const PRODUCT_IMAGES_PREFIX = `${UPLOADS_PREFIX}products/`;

export type ImageExt = 'jpg' | 'png' | 'webp';

/** Carpeta raíz de archivos subidos (se sirve tal cual en /api/v1/uploads). */
export const uploadsRoot = (): string => resolve(process.env.UPLOADS_DIR || join(process.cwd(), 'uploads'));

/** JPEG, PNG o WebP según la firma del archivo; null si es otra cosa (SVG, GIF, PDF, texto…). */
export function detectImageType(buf: Buffer): ImageExt | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

const FILE_RE = /^[0-9a-f-]{36}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** Guarda la foto con un nombre nuevo y devuelve la ruta pública que va en image_url. */
export async function saveProductImage(productId: string, buf: Buffer, ext: ImageExt): Promise<string> {
  const dir = join(uploadsRoot(), 'products');
  await mkdir(dir, { recursive: true });
  const file = `${productId}-${randomBytes(6).toString('hex')}.${ext}`;
  await writeFile(join(dir, file), buf, { flag: 'wx' });
  return PRODUCT_IMAGES_PREFIX + file;
}

/** Borra el archivo de una foto subida antes (las rutas del catálogo o URL externas no se tocan). */
export async function removeUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith(PRODUCT_IMAGES_PREFIX)) return;
  const file = basename(url);
  if (!FILE_RE.test(file)) return;
  await unlink(join(uploadsRoot(), 'products', file)).catch(() => undefined);
}
