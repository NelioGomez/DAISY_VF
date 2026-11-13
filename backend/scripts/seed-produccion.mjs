/* =====================================================================
   Datos de PRODUCCIÓN para la demostración: mangueras Continental Contitech.

   Materia prima (6 productos de NORCOR, marca Goodyear):
     mangueras 3/4" y 1" en carrete de 500 pies, acoples macho y terminales hembra.
   Productos terminados (ensamblados en el taller):
     mangueras 3/4" y 1" cortadas a medida, con un acople macho y un terminal hembra.
   Para cada producto terminado: lista de materiales (BOM) y ruta de 3 operaciones.
   Órdenes de producción de ejemplo en cada estado: borrador, liberada, en proceso,
   terminada con lote pendiente de calidad, liberada por calidad, con retrabajo y con desecho.

   Carga TODO por la API (como seed-demo.mjs): respeta inventario, numeración y auditoría.
   Uso:  API_URL=https://<backend>/api/v1 node scripts/seed-produccion.mjs
         (usa SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD del .env)
   Se puede repetir: no duplica productos, BOM ni rutas, y las órdenes solo se crean la primera vez.

   COSTOS: los valores de COSTO_UNITARIO son REFERENCIALES (C$), solo para que las órdenes y
   los lotes muestren un costo. Cámbielos por los costos reales antes de correr el script.
   ===================================================================== */
import 'dotenv/config';

const API = (process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/v1`).replace(/\/$/, '');
const ADMIN_USER = process.env.SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD;
const MARCA = 'Goodyear';
const PROVEEDOR = { name: 'Continental ContiTech', country: 'EE.UU.', contactName: 'Distribución LATAM', taxId: 'US-CONTI-001' };

/** Costo de compra por unidad del inventario inicial (C$). REFERENCIAL: ajústelo. */
const COSTO_UNITARIO = {
  20021879: 130, // por pie, manguera 3/4"
  20021888: 185, // por pie, manguera 1"
  20123980: 550, // acople macho 3/4"
  20123981: 220, // terminal hembra 3/4"
  20123982: 800, // acople macho 1"
  20123983: 330, // terminal hembra 1"
};

// Materia prima: [sku, nombre, existencia, mínimo, unidad, categoría, descripción]
const MATERIA_PRIMA = [
  ['20021879', 'CONTINENTAL Contitech 3/4" X 500\' Reel', 1000, 500, 'FOOT', 'Manguera', 'Medida: 3/4 pulgada. Carrete de 500 pies; se vende y consume por pie.'],
  ['20021888', 'CONTINENTAL Contitech 1" X 500\' Reel', 1000, 500, 'FOOT', 'Manguera', 'Medida: 1 pulgada. Carrete de 500 pies; se vende y consume por pie.'],
  ['20123980', 'CONTINENTAL 3/4" Male Solid Stem Fuelgrip', 200, 100, 'UNIT', 'Acople macho', 'Medida: 3/4 pulgada.'],
  ['20123981', 'CONTINENTAL 3/4" Ferrule Fuelgrip Fitting', 200, 100, 'UNIT', 'Terminal hembra', 'Medida: 3/4 pulgada.'],
  ['20123982', 'CONTINENTAL 1" Male Solid Stem Fuelgrip', 200, 100, 'UNIT', 'Acople macho', 'Medida: 1 pulgada.'],
  ['20123983', 'CONTINENTAL 1" Ferrule Fuelgrip Fitting', 200, 100, 'UNIT', 'Terminal hembra', 'Medida: 1 pulgada.'],
];

// Producto terminado: [sku, nombre, pies, sku manguera, sku acople macho, sku terminal hembra, medida]
const TERMINADOS = [
  ['MNG-CT34-10P', 'Manguera Contitech 3/4" × 10 pies con acoples', 10, '20021879', '20123980', '20123981', '3/4"'],
  ['MNG-CT34-15P', 'Manguera Contitech 3/4" × 15 pies con acoples', 15, '20021879', '20123980', '20123981', '3/4"'],
  ['MNG-CT1-10P', 'Manguera Contitech 1" × 10 pies con acoples', 10, '20021888', '20123982', '20123983', '1"'],
  ['MNG-CT1-20P', 'Manguera Contitech 1" × 20 pies con acoples', 20, '20021888', '20123982', '20123983', '1"'],
];

let token = '';

async function call(method, path, body, { allowConflict = false } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 409 && allowConflict) return null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.message} ${JSON.stringify(json.errors ?? [])}`);
  return json.data;
}

const all = async (path) => (await call('GET', `${path}${path.includes('?') ? '&' : '?'}limit=100`)) ?? [];

async function main() {
  if (!ADMIN_PASS) throw new Error('Falta SEED_ADMIN_PASSWORD en el .env');
  ({ accessToken: token } = await call('POST', '/auth/login', { username: ADMIN_USER, password: ADMIN_PASS }));
  console.log(`✓ Sesión de administrador en ${API}`);

  /* ---------- Catálogos ---------- */
  const categorias = [...new Set([...MATERIA_PRIMA.map((m) => m[5]), 'Mangueras ensambladas'])];
  for (const name of categorias) await call('POST', '/categories', { name }, { allowConflict: true });
  await call('POST', '/brands', { name: MARCA }, { allowConflict: true });
  await call('POST', '/suppliers', PROVEEDOR, { allowConflict: true });
  const cats = Object.fromEntries((await all('/categories')).map((c) => [c.name, c.id]));
  const brandId = (await all('/brands')).find((b) => b.name === MARCA)?.id;
  const supplierId = (await all('/suppliers')).find((s) => s.name === PROVEEDOR.name)?.id;
  console.log('✓ Categorías, marca y proveedor');

  /* ---------- Materia prima + inventario inicial ---------- */
  let nuevos = 0;
  for (const [sku, name, stock, minStock, unit, cat, description] of MATERIA_PRIMA) {
    const p = await call('POST', '/products', { sku, name, unit, minStock, description, brandId, categoryId: cats[cat] }, { allowConflict: true });
    if (p) {
      nuevos++;
      await call('POST', '/inventory/movements', {
        productId: p.id, type: 'ENTRY', quantity: stock, unitCost: COSTO_UNITARIO[sku], supplierId, reference: 'Inventario inicial',
      });
    }
  }
  console.log(`✓ Materia prima: ${nuevos} productos nuevos con su entrada de inventario`);

  /* ---------- Productos terminados ---------- */
  for (const [sku, name, pies, , , , medida] of TERMINADOS) {
    await call('POST', '/products', {
      sku, name, unit: 'UNIT', minStock: 2, brandId, categoryId: cats['Mangueras ensambladas'],
      description: `Manguera de despacho ${medida} ensamblada en el taller: ${pies} pies con acople macho y terminal hembra Fuelgrip.`,
    }, { allowConflict: true });
  }
  // Búsqueda por SKU (el listado general está paginado y puede haber más de 100 productos).
  const bySku = {};
  for (const s of [...MATERIA_PRIMA.map((m) => m[0]), ...TERMINADOS.map((t) => t[0])]) {
    bySku[s] = (await all(`/products?search=${encodeURIComponent(s)}`)).find((p) => p.sku === s)?.id;
    if (!bySku[s]) throw new Error(`No se encontró el producto ${s}`);
  }
  console.log(`✓ Productos terminados: ${TERMINADOS.length}`);

  /* ---------- Listas de materiales y rutas ---------- */
  const tieneBom = async (id) => ((await call('GET', `/production/boms?productId=${id}`)) ?? []).some((b) => b.isActive);
  const tieneRuta = async (id) => ((await call('GET', `/production/routes?productId=${id}`)) ?? []).some((r) => r.isActive);
  for (const [sku, , pies, manguera, macho, hembra, medida] of TERMINADOS) {
    const productId = bySku[sku];
    if (!(await tieneBom(productId))) {
      await call('POST', '/production/boms', {
        productId,
        notes: `Corte de ${pies} pies y un acople en cada extremo.`,
        items: [
          { componentId: bySku[manguera], quantity: pies, notes: `Cortar a ${pies} pies` },
          { componentId: bySku[macho], quantity: 1, notes: 'Extremo 1' },
          { componentId: bySku[hembra], quantity: 1, notes: 'Extremo 2' },
        ],
      });
    }
    if (!(await tieneRuta(productId))) {
      await call('POST', '/production/routes', {
        productId,
        name: `Ensamble de manguera ${medida} × ${pies} pies`,
        operations: [
          { name: 'Medición y corte', workCenter: 'Mesa de corte', standardMinutes: 3, instructions: `Medir ${pies} pies sobre la mesa graduada y cortar a escuadra.` },
          { name: 'Acoplamiento de terminales', workCenter: 'Prensa engargoladora', standardMinutes: 6, instructions: 'Insertar acople macho y terminal hembra Fuelgrip y engargolar a la medida indicada.' },
          { name: 'Verificación', workCenter: 'Banco de prueba', standardMinutes: 4, instructions: 'Prueba de presión, revisión de fugas y medida final.' },
        ],
      });
    }
  }
  console.log('✓ Listas de materiales (BOM) y rutas');

  /* ---------- Órdenes de producción (solo la primera vez) ---------- */
  const terminados = new Set(TERMINADOS.map((t) => bySku[t[0]]));
  const existentes = (await all('/production/orders')).filter((o) => terminados.has(o.product?.id));
  if (existentes.length) {
    console.log(`• Ya hay ${existentes.length} órdenes de estos productos: no se crean ejemplos`);
    return;
  }

  const dia = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
  const crear = (sku, quantity, notes, plannedStart, dueDate) =>
    call('POST', '/production/orders', { productId: bySku[sku], quantity, notes, plannedStart, dueDate });
  const iniciar = async (o) => {
    await call('POST', `/production/orders/${o.id}/release`);
    return call('POST', `/production/orders/${o.id}/start`);
  };
  const pasos = async (o, cuantos = Infinity) => {
    let actual = o;
    for (const s of o.steps.slice(0, cuantos)) actual = await call('POST', `/production/orders/${o.id}/steps/${s.id}/complete`, {});
    return actual;
  };
  const terminar = async (o, producedQuantity, notes) => {
    const fin = await call('POST', `/production/orders/${o.id}/complete`, { producedQuantity, notes });
    return fin.lots[0];
  };
  const inspeccionar = (lote, defectiveQuantity, disposition, defectDescription, notes) =>
    call('POST', `/production/lots/${lote.id}/inspections`, { defectiveQuantity, disposition, defectDescription, notes });

  // 1) Terminada y liberada por calidad: las 10 entran al inventario.
  let o = await iniciar(await crear('MNG-CT34-10P', 10, 'Pedido de reposición para tienda', dia(-6), dia(-3)));
  o = await pasos(o);
  await inspeccionar(await terminar(o, 10), 0, undefined, undefined, 'Prueba de presión conforme en todas las unidades');

  // 2) Terminada con retrabajo: 5 conformes al inventario, 1 vuelve a la prensa.
  o = await iniciar(await crear('MNG-CT1-10P', 6, 'Pedido Estación Puma Carretera Norte', dia(-5), dia(-2)));
  o = await pasos(o);
  await inspeccionar(await terminar(o, 6), 1, 'REWORK', 'Fuga leve en el terminal hembra durante la prueba de presión', 'Re-engargolar y volver a probar');

  // 3) Terminada con desecho: 1 manguera cortada fuera de medida.
  o = await iniciar(await crear('MNG-CT34-15P', 8, 'Stock para mantenimiento de surtidores', dia(-4), dia(-1)));
  o = await pasos(o);
  await inspeccionar(await terminar(o, 8), 1, 'SCRAP', 'Corte 6 pulgadas más corto que la medida', 'Se desecha la unidad; revisar la regla de la mesa de corte');

  // 4) Terminada, lote PENDIENTE de calidad (para inspeccionarlo en vivo en la exposición).
  o = await iniciar(await crear('MNG-CT1-20P', 3, 'Pedido Servicentro UNO Las Colinas', dia(-2), dia(1)));
  o = await pasos(o);
  await terminar(o, 3);

  // 5) En proceso: materiales consumidos y primer paso hecho.
  o = await iniciar(await crear('MNG-CT34-10P', 12, 'Reposición de stock mínimo', dia(-1), dia(2)));
  await pasos(o, 1);

  // 6) Liberada: lista para iniciar (todavía no consume materiales).
  o = await crear('MNG-CT1-10P', 4, 'Pedido Gasolinera Petronic León', dia(1), dia(3));
  await call('POST', `/production/orders/${o.id}/release`);

  // 7) Borrador: planificada para la próxima semana.
  await crear('MNG-CT34-15P', 6, 'Planificación semanal', dia(5), dia(7));

  console.log('✓ 7 órdenes de producción: 4 terminadas (liberada, retrabajo, desecho, pendiente de calidad), 1 en proceso, 1 liberada y 1 borrador');
}

main()
  .then(() => console.log('\nListo. Revise Producción → Órdenes, Lotes y Listas de materiales.'))
  .catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
