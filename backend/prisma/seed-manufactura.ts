/**
 * Datos maestros del producto piloto de manufactura (entrega 2): manguera 3/4" × 10 pies.
 *   npm run seed:manufactura
 * Crea (si no existen) los componentes, el producto terminado, su lista de materiales y su ruta.
 * No crea existencias ni precios: los componentes entran con una compra y su recepción, y el
 * precio de venta lo fija Gerencia, para demostrar el flujo compra → recepción → producción →
 * inventario → venta con documentos reales del sistema.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UnitOfMeasure } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c TimeZone=UTC' }),
});

const PRODUCTS = [
  { sku: 'MNG-34-PIE', name: 'Manguera 3/4" a granel (por pie)', category: 'Mangueras', unit: UnitOfMeasure.FOOT, minStock: 50, description: 'Manguera de despacho 3/4" que se corta a la medida.' },
  { sku: 'TRM-34-M', name: 'Terminal macho 3/4" NPT', category: 'Conectores', unit: UnitOfMeasure.UNIT, minStock: 10, description: 'Terminal para engargolar en manguera de 3/4".' },
  { sku: 'TRM-34-H', name: 'Terminal hembra 3/4" NPT', category: 'Conectores', unit: UnitOfMeasure.UNIT, minStock: 10, description: 'Terminal giratorio para engargolar en manguera de 3/4".' },
  { sku: 'MNG-34-10P', name: 'Manguera 3/4" × 10 pies con terminales', category: 'Mangueras', unit: UnitOfMeasure.UNIT, minStock: 2, description: 'Manguera ensamblada en el taller: 10 pies con terminal macho y hembra.' },
];

async function code(key: string, prefix: string) {
  const row = await prisma.documentSequence.upsert({ where: { key }, update: { lastValue: { increment: 1 } }, create: { key, lastValue: 1 }, select: { lastValue: true } });
  return `${prefix}-${String(row.lastValue).padStart(6, '0')}`;
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { username: 'admin' }, select: { id: true } });
  if (!admin) throw new Error('Ejecute primero el seed principal (npm run prisma:seed)');

  const ids: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const category = await prisma.category.upsert({ where: { name: p.category }, update: {}, create: { name: p.category }, select: { id: true } });
    const existing = await prisma.product.findUnique({ where: { sku: p.sku }, select: { id: true } });
    const product =
      existing ??
      (await prisma.product.create({
        data: { sku: p.sku, name: p.name, description: p.description, unit: p.unit, minStock: p.minStock, categoryId: category.id },
        select: { id: true },
      }));
    ids[p.sku] = product.id;
    console.log(`${existing ? '·' : '+'} ${p.sku}  ${p.name}`);
  }

  const finished = ids['MNG-34-10P'];
  if (!(await prisma.bom.findFirst({ where: { productId: finished } }))) {
    const bom = await prisma.bom.create({
      data: {
        code: await code('BOM', 'LM'),
        productId: finished,
        createdById: admin.id,
        notes: 'Corte de 10 pies y un terminal en cada extremo.',
        items: {
          create: [
            { componentId: ids['MNG-34-PIE'], quantity: 10, notes: 'Cortar a 10 pies' },
            { componentId: ids['TRM-34-M'], quantity: 1 },
            { componentId: ids['TRM-34-H'], quantity: 1 },
          ],
        },
      },
      select: { code: true },
    });
    console.log(`+ BOM ${bom.code}`);
  }

  if (!(await prisma.productionRoute.findFirst({ where: { productId: finished } }))) {
    const route = await prisma.productionRoute.create({
      data: {
        code: await code('ROUTE', 'RT'),
        productId: finished,
        name: 'Ensamble de manguera 3/4"',
        operations: {
          create: [
            { sequence: 10, name: 'Medición y corte', workCenter: 'Mesa de corte', standardMinutes: 3, instructions: 'Medir 10 pies y cortar a escuadra.' },
            { sequence: 20, name: 'Acoplamiento de terminales', workCenter: 'Prensa engargoladora', standardMinutes: 6, instructions: 'Engargolar terminal macho y hembra.' },
            { sequence: 30, name: 'Verificación', workCenter: 'Banco de prueba', standardMinutes: 4, instructions: 'Prueba de presión y revisión de fugas.' },
          ],
        },
      },
      select: { code: true },
    });
    console.log(`+ Ruta ${route.code}`);
  }
  console.log('Listo: cargue los componentes con una compra y su recepción, y fije el precio del producto terminado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
