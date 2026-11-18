/* =====================================================================
   Datos de demostración para probar SIVEN de punta a punta.
   Carga a través de la API (no directo en la BD), así respeta todas las
   reglas: movimientos de inventario, numeración, saldos y auditoría.

   Requisitos: API corriendo y semilla base aplicada (npx prisma db seed).
   Uso:  node scripts/seed-demo.mjs
         API_URL=http://localhost:3000/api/v1 node scripts/seed-demo.mjs

   Es idempotente en lo básico: si un registro ya existe (409) lo reutiliza.
   NO usar en producción: crea usuarios con contraseña conocida.
   ===================================================================== */
import 'dotenv/config';

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/v1`;
const ADMIN_USER = process.env.SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD;
const DEMO_PASSWORD = 'Siven2026demo!';

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
  console.log('✓ Sesión de administrador');

  /* ---------- Usuarios por rol ---------- */
  const users = [
    { username: 'gerencia', firstName: 'Gerencia', lastName: 'General', email: 'gerencia@norcor.example', role: 'MANAGEMENT' },
    { username: 'jflores', firstName: 'Joshua', lastName: 'Flores', email: 'jflores@norcor.example', role: 'SELLER' },
    { username: 'ngomez', firstName: 'Nelio', lastName: 'Gómez', email: 'ngomezanderson@gmail.com', role: 'INVENTORY_MANAGER' },
    { username: 'eurcuyo', firstName: 'Ernesto', lastName: 'Urcuyo', email: 'eurcuyo@norcor.example', role: 'ACCOUNTING' },
    { username: 'tlopez', firstName: 'Luis', lastName: 'López', email: 'tlopez@norcor.example', role: 'TECHNICIAN' },
    { username: 'truiz', firstName: 'Mario', lastName: 'Ruiz', email: 'truiz@norcor.example', role: 'TECHNICIAN' },
  ];
  for (const u of users) await call('POST', '/users', { ...u, password: DEMO_PASSWORD }, { allowConflict: true });
  console.log(`✓ ${users.length} usuarios (contraseña: ${DEMO_PASSWORD})`);

  /* ---------- Categorías y marcas ---------- */
  const catNames = ['Dispensadores', 'Filtros', 'Mangueras', 'Boquillas', 'Eléctrico', 'Conectores', 'Bombas', 'Sellos'];
  for (const name of catNames) await call('POST', '/categories', { name }, { allowConflict: true });
  for (const name of ['OPW', 'Gilbarco', 'Tatsuno']) await call('POST', '/brands', { name }, { allowConflict: true });
  const cats = Object.fromEntries((await all('/categories')).map((c) => [c.name, c.id]));
  const brands = Object.fromEntries((await all('/brands')).map((b) => [b.name, b.id]));
  console.log('✓ Categorías y marcas');

  /* ---------- Proveedores y clientes ---------- */
  const suppliers = [
    { name: 'Gilbarco Veeder-Root', taxId: 'US-GVR-001', country: 'EE.UU.', contactName: 'Sales Dept.', phone: '+1 800 555 0100', email: 'sales@gilbarco.example', address: 'Greensboro, NC' },
    { name: 'Tatsuno Centroamérica', taxId: 'PA-TAT-002', country: 'Panamá', contactName: 'L. Mejía', phone: '+507 6000 0000', email: 'ventas@tatsuno-ca.example', address: 'Ciudad de Panamá' },
    { name: 'Repuestos Industriales NIC', taxId: 'J0310000054321', country: 'Nicaragua', contactName: 'R. Castro', phone: '+505 2278 0000', email: 'info@repinic.example', address: 'Managua' },
    { name: 'OPW Fuel Components', taxId: 'US-OPW-004', country: 'EE.UU.', contactName: 'Distrib. LATAM', phone: '+1 513 555 0100', email: 'latam@opw.example', address: 'Cincinnati, OH' },
  ];
  for (const s of suppliers) await call('POST', '/suppliers', s, { allowConflict: true });
  const customers = [
    { name: 'Estación Puma Carretera Norte', ruc: 'J0310000111222', contactName: 'Ing. Pérez', phone: '+505 8855 1100', email: 'compras@pumacn.example', address: 'Managua, Km 7' },
    { name: 'Servicentro UNO Las Colinas', ruc: 'J0310000333444', contactName: 'Lic. Sánchez', phone: '+505 8844 2200', email: 'admin@unocolinas.example', address: 'Managua' },
    { name: 'Gasolinera Petronic León', ruc: 'J0310000555666', contactName: 'M. Rivas', phone: '+505 8833 3300', email: 'leon@petronic.example', address: 'León' },
    { name: 'Taller Mantenimiento FuelTech', ruc: 'J0310000777888', contactName: 'Téc. Gómez', phone: '+505 8822 4400', email: 'fueltech@correo.example', address: 'Masaya' },
    { name: 'Estación Shell Carretera Sur', ruc: 'J0310000999000', contactName: 'Ing. Mora', phone: '+505 8811 5500', email: 'shellsur@correo.example', address: 'Managua' },
  ];
  for (const c of customers) await call('POST', '/customers', c, { allowConflict: true });
  const supByName = Object.fromEntries((await all('/suppliers')).map((s) => [s.name, s.id]));
  const cusByName = Object.fromEntries((await all('/customers')).map((c) => [c.name, c.id]));
  console.log('✓ Proveedores y clientes');

  /* ---------- Productos + entrada inicial de inventario ---------- */
  const products = [
    ['DSP-NZL-01', 'Boquilla automática surtidor 11A', 'OPW', 'Boquillas', 1850, 2890, 42, 15, 'OPW Fuel Components'],
    ['DSP-HSE-02', 'Manguera de despacho 3/4" x 4m', 'Gilbarco', 'Mangueras', 980, 1620, 8, 12, 'Gilbarco Veeder-Root'],
    ['FLT-PRT-03', 'Filtro de partículas 10 micras', 'OPW', 'Filtros', 420, 720, 60, 20, 'OPW Fuel Components'],
    ['ELE-DSP-04', 'Display LCD para dispensador', 'Tatsuno', 'Eléctrico', 3200, 4950, 5, 6, 'Tatsuno Centroamérica'],
    ['PMP-SUB-05', 'Bomba sumergible turbina 1.5HP', 'Gilbarco', 'Bombas', 14500, 21800, 3, 4, 'Gilbarco Veeder-Root'],
    ['CON-SWV-06', 'Conector giratorio (swivel) 3/4"', 'OPW', 'Conectores', 560, 920, 28, 15, 'OPW Fuel Components'],
    ['DSP-BRK-07', 'Break-away de seguridad', 'OPW', 'Dispensadores', 740, 1280, 2, 8, 'OPW Fuel Components'],
    ['SEL-KIT-08', 'Kit de sellos para pistola', 'Tatsuno', 'Sellos', 180, 340, 75, 25, 'Tatsuno Centroamérica'],
    ['ELE-PUL-09', 'Pulser/medidor de flujo electrónico', 'Gilbarco', 'Eléctrico', 2600, 3990, 11, 8, 'Gilbarco Veeder-Root'],
    ['FLT-WTR-10', 'Filtro separador de agua', 'OPW', 'Filtros', 650, 1080, 18, 12, 'Repuestos Industriales NIC'],
    ['MNG-VAP-11', 'Manguera de recuperación de vapor', 'Gilbarco', 'Mangueras', 1120, 1790, 1, 6, 'Gilbarco Veeder-Root'],
    ['CON-ADP-12', 'Adaptador de llenado hermético', 'Tatsuno', 'Conectores', 390, 690, 33, 15, 'Tatsuno Centroamérica'],
  ];
  let created = 0;
  for (const [sku, name, brand, cat, cost, price, stock, min, sup] of products) {
    const p = await call('POST', '/products', { sku, name, brandId: brands[brand], categoryId: cats[cat], salePrice: price, minStock: min }, { allowConflict: true });
    if (p) {
      created++;
      await call('POST', '/inventory/movements', { productId: p.id, type: 'ENTRY', quantity: stock, unitCost: cost, supplierId: supByName[sup], reference: 'Carga inicial' });
    }
  }
  const prodBySku = Object.fromEntries((await all('/products')).map((p) => [p.sku, p.id]));
  console.log(`✓ Productos (${created} nuevos con su entrada de inventario)`);

  /* ---------- Documentos comerciales (solo la primera vez) ---------- */
  const existingSales = await all('/sales');
  if (existingSales.length === 0) {
    const item = (sku, quantity) => ({ productId: prodBySku[sku], quantity });
    const sales = [
      ['Estación Puma Carretera Norte', [item('DSP-NZL-01', 6), item('SEL-KIT-08', 10)], { paymentMethod: 'CASH' }],
      ['Gasolinera Petronic León', [item('FLT-PRT-03', 12), item('FLT-WTR-10', 4)], { paymentMethod: 'TRANSFER', reference: 'TRF-BANPRO-88213' }],
      ['Servicentro UNO Las Colinas', [item('ELE-PUL-09', 2)], { paymentMethod: 'CREDIT', creditDays: 15, initialPayment: 4000, initialPaymentMethod: 'TRANSFER', reference: 'TRF-LAFISE-55120' }],
      ['Estación Shell Carretera Sur', [item('CON-SWV-06', 8), item('CON-ADP-12', 6)], { paymentMethod: 'CASH' }],
      ['Taller Mantenimiento FuelTech', [item('FLT-PRT-03', 8), item('SEL-KIT-08', 15)], { paymentMethod: 'CREDIT', creditDays: 30 }],
    ];
    for (const [cus, items, terms] of sales) await call('POST', '/sales', { customerId: cusByName[cus], items, ...terms });

    const q1 = await call('POST', '/quotations', { customerId: cusByName['Servicentro UNO Las Colinas'], items: [item('ELE-DSP-04', 2), item('PMP-SUB-05', 1)], notes: 'Renovación de surtidor #2' });
    const q2 = await call('POST', '/quotations', { customerId: cusByName['Taller Mantenimiento FuelTech'], items: [item('FLT-PRT-03', 20)] });
    await call('POST', `/quotations/${q2.id}/approve`);
    void q1;

    const techs = await call('GET', '/service-orders/technicians');
    const o1 = await call('POST', '/service-orders', { customerId: cusByName['Estación Puma Carretera Norte'], description: 'Reemplazo de break-away y calibración de surtidor #3', technicianId: techs[0]?.id });
    await call('POST', `/service-orders/${o1.id}/start`);
    await call('POST', '/service-orders', { customerId: cusByName['Servicentro UNO Las Colinas'], description: 'Diagnóstico de display LCD intermitente', technicianId: techs[1]?.id });
    await call('POST', '/service-orders', { customerId: cusByName['Gasolinera Petronic León'], description: 'Instalación de bomba sumergible nueva' });

    token = '';
    await call('POST', '/public/inquiries', { name: 'Estación Texaco Granada', contact: '+505 8800 9090', productInterest: 'Boquillas', message: 'Necesito cotización de 4 boquillas automáticas y mangueras.' });
    console.log('✓ Ventas, cotizaciones, órdenes de servicio y una consulta web');
  } else {
    console.log('• Ya hay ventas registradas: no se crean documentos de ejemplo');
  }

  console.log('\nListo. Usuarios de prueba: gerencia, jflores, ngomez, eurcuyo, tlopez, truiz');
  console.log(`Contraseña de todos: ${DEMO_PASSWORD}  (admin usa SEED_ADMIN_PASSWORD)`);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
