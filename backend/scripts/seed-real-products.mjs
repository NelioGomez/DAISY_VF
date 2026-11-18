/**
 * Carga de datos reales/depurados desde los Excel de NORCOR.
 *
 * Origen:
 * - Items - 30.10.12 --.xlsx: SOLO las 173 filas visibles del filtro.
 * - Listado-Precio...xlsx: precios C$ únicamente cuando el cruce fue suficientemente confiable.
 * - Catalogo...xlsx: imágenes embebidas copiadas al frontend/public/product-images/catalogo.
 *
 * Diseño:
 * - Crea marcas y categorías por API.
 * - Crea/actualiza datos maestros de productos por API.
 * - El stock de productos NUEVOS entra mediante InventoryMovement ENTRY (no se escribe directo).
 * - Para productos existentes, NO fuerza el stock salvo SEED_FORCE_STOCK=true.
 * - El costo inicial queda en 0 porque los Excel entregados no aportan costo de compra confiable.
 *
 * Requisitos:
 *   SEED_ADMIN_PASSWORD=...
 * Opcionales:
 *   API_URL=http://localhost:3000/api/v1
 *   SEED_ADMIN_USERNAME=admin
 *   SEED_FORCE_STOCK=true       # solo demo/base vacía; crea ADJUSTMENT en productos existentes
 *   SEED_UPDATE_EXISTING=false  # si no desea actualizar metadatos existentes
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(await readFile(join(HERE, 'data', 'norcor-products.json'), 'utf8'));

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/v1`;
const ADMIN_USER = process.env.SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD;
const FORCE_STOCK = String(process.env.SEED_FORCE_STOCK ?? 'false').toLowerCase() === 'true';
const UPDATE_EXISTING = String(process.env.SEED_UPDATE_EXISTING ?? 'true').toLowerCase() !== 'false';

let token = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body, { allowConflict = false } = {}) {
  let res;
  // La API limita a 100 peticiones por minuto: ante un 429 se espera lo que indique y se reintenta.
  for (let attempt = 1; ; attempt++) {
    res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status !== 429 || attempt > 10) break;
    const wait = Math.max(1, Number(res.headers.get('retry-after')) || 15);
    console.log(`  … límite de peticiones de la API: esperando ${wait} s`);
    await sleep(wait * 1000);
  }
  const json = await res.json().catch(() => ({}));

  if (res.status === 409 && allowConflict) {
    return null;
  }

  // Si NestJS activa el Throttler, esperamos y reintentamos.
  if (res.status === 429 && retry < 5) {
    const retryAfterHeader = Number(
      res.headers.get('retry-after'),
    );

    const retryAfterMs =
      Number.isFinite(retryAfterHeader) &&
      retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 10_000;

    console.log(
      `⏳ Límite de peticiones alcanzado. Reintentando ${method} ${path}...`,
    );

    await sleep(retryAfterMs);

    return call(method, path, body, {
      allowConflict,
      retry: retry + 1,
    });
  }

  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${
        json.message ?? 'Error'
      } ${JSON.stringify(json.errors ?? [])}`,
    );
  }

  return json.data;
}

async function all(path, limit = 100) {
  const result = [];
  for (let page = 1; page < 100; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const rows = (await call('GET', `${path}${sep}page=${page}&limit=${limit}`)) ?? [];
    if (!Array.isArray(rows)) return rows;
    result.push(...rows);
    if (rows.length < limit) break;
  }
  return result;
}

/**
 * El SKU de SIVEN solo admite letras, números, punto, guion, guion bajo y diagonal (sin espacios).
 * Diez códigos del Excel traen espacios ("91-050 NPT"): se guardan con guion ("91-050-NPT").
 */
const skuOf = (p) => p.sku.trim().toUpperCase().replace(/\s+/g, '-');

function productBody(p, brandIds, categoryIds) {
  return {
    sku: skuOf(p),
    name: p.name,
    description: p.description || undefined,
    unit: p.unit ?? 'UNIT', 
    brandId: brandIds[p.brand] ?? null,
    categoryId: categoryIds[p.category] ?? null,
    imageUrl: p.imageUrl ?? null,
    minStock: p.minStock,
    maxStock: p.maxStock,
    ...(p.salePrice > 0 ? { salePrice: p.salePrice } : {}),
  };
}

async function main() {
  if (!ADMIN_PASS) throw new Error('Falta SEED_ADMIN_PASSWORD en el .env o en la terminal.');

  ({ accessToken: token } = await call('POST', '/auth/login', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  }));
  console.log(`✓ Sesión administrativa en ${API}`);

  const brandNames = [...new Set(products.map((p) => p.brand))].sort();
  const categoryNames = [...new Set(products.map((p) => p.category))].sort();

  for (const name of brandNames) {
    await call('POST', '/brands', { name }, { allowConflict: true });
  }
  for (const name of categoryNames) {
    await call(
      'POST',
      '/categories',
      { name, description: 'Clasificación inicial importada/normalizada desde los Excel de NORCOR.' },
      { allowConflict: true },
    );
  }

  const brandIds = Object.fromEntries((await all('/brands')).map((x) => [x.name, x.id]));
  const categoryIds = Object.fromEntries((await all('/categories')).map((x) => [x.name, x.id]));
  console.log(`✓ ${brandNames.length} marcas y ${categoryNames.length} categorías disponibles`);

  const existing = Object.fromEntries((await all('/products')).map((x) => [x.sku, x]));
  let created = 0;
  let updated = 0;
  let stockLoaded = 0;
  let stockAdjusted = 0;
  let skipped = 0;
  let imageCount = 0;
  let priceCount = 0;

  for (const p of products) {
    const body = productBody(p, brandIds, categoryIds);
    if (p.imageUrl) imageCount++;
    if (p.salePrice > 0) priceCount++;

    let current = existing[body.sku];
    if (!current) {
      current = await call('POST', '/products', body);
      existing[body.sku] = current;
      created++;

      if (p.stock > 0) {
        await call('POST', '/inventory/movements', {
          productId: current.id,
          type: 'ENTRY',
          quantity: p.stock,
          unitCost: 0,
          reference: 'Carga inicial Excel NORCOR',
        });
        stockLoaded++;
      }
      continue;
    }

    if (!UPDATE_EXISTING) {
      skipped++;
      continue;
    }

    // No mandamos salePrice en el PATCH general: el precio tiene endpoint e historial propio.
    const { salePrice: desiredPrice, ...metadata } = body;
    await call('PATCH', `/products/${current.id}`, metadata);
    updated++;

    if (p.salePrice > 0 && Number(current.salePrice ?? 0) !== p.salePrice) {
      await call('PATCH', `/products/${current.id}/price`, {
        salePrice: p.salePrice,
        reason: 'Precio sustentado por listado NORCOR importado',
      });
    }

    if (FORCE_STOCK && Number(current.stock ?? 0) !== p.stock) {
      // Con bodega y sucursal el ajuste fija lo contado en UNA ubicación. La sucursal se deja como
      // está (si no supera el total sugerido) y la bodega completa la diferencia.
      const here = (loc) => (current.stockByLocation ?? []).find((s) => s.locationId === loc)?.quantity ?? 0;
      const adjust = async (locationId, newStock) => {
        if (here(locationId) === newStock) return;
        await call('POST', '/inventory/movements', {
          productId: current.id,
          type: 'ADJUSTMENT',
          locationId,
          newStock,
          reference: 'Ajuste de semilla NORCOR',
          note: 'Stock sugerido generado desde la depuración de los Excel de NORCOR.',
        });
      };
      const branch = here(2);
      if (branch > p.stock) {
        await adjust(2, p.stock);
        await adjust(1, 0);
      } else {
        await adjust(1, p.stock - branch);
      }
      stockAdjusted++;
    }
  }

  console.log('\n=== Carga terminada ===');
  console.log(`Productos del archivo:          ${products.length}`);
  console.log(`Nuevos creados:                 ${created}`);
  console.log(`Existentes actualizados:        ${updated}`);
  console.log(`Existentes omitidos:            ${skipped}`);
  console.log(`Entradas iniciales registradas: ${stockLoaded}`);
  console.log(`Stocks existentes ajustados:    ${stockAdjusted}${FORCE_STOCK ? '' : ' (SEED_FORCE_STOCK=false)'}`);
  console.log(`Productos con imagen asignada:  ${imageCount}`);
  console.log(`Productos con precio C$:        ${priceCount}`);
  console.log('\nNota: avgCost queda en 0 mientras no se registren costos reales de compra/recepción.');
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
