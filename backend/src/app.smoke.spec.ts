import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * Prueba de humo: levanta la aplicación completa (módulos, guards, pipes, filtros)
 * con una base de datos simulada, para comprobar el cableado de extremo a extremo.
 */
describe('API (smoke)', () => {
  let app: INestApplication;
  let token: string;

  const productRow = {
    id: '11111111-1111-4111-8111-111111111111',
    sku: 'GIL-001',
    name: 'Boquilla',
    description: null,
    categoryId: null,
    brandId: null,
    avgCost: { toString: () => '10.5' },
    salePrice: { toString: () => '25' },
    stock: 3,
    minStock: 5,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    category: null,
    brand: null,
  };

  const prismaMock = {
    $queryRaw: jest.fn().mockResolvedValue([1]),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        username: 'vendedor',
        isActive: true,
        role: { code: 'SELLER', permissions: [{ permission: { code: 'products:read' } }] },
      }),
    },
    product: {
      fields: { minStock: 'REF' },
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([productRow]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(productRow),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    webInquiry: {
      create: jest.fn().mockResolvedValue({ id: 'i1' }),
    },
    customer: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sale: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { total: null, balance: null } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_EXPIRES_IN = '15m';

    // require (no import estático): el módulo valida las variables de entorno al cargarse.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { AppModule } = require('./app.module') as typeof import('./app.module');
    const { PrismaService } = require('./prisma/prisma.service') as typeof import('./prisma/prisma.service');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    token = app.get(JwtService).sign({ sub: 'u1', username: 'vendedor', role: 'SELLER' });
  });

  afterAll(() => app.close());

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const server = () => app.getHttpServer();

  it('GET /health es público y usa el formato uniforme', async () => {
    const res = await request(server()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', database: 'up' } });
  });

  it('una ruta protegida sin token → 401 con formato de error', async () => {
    const res = await request(server()).get('/api/v1/products').expect(401);
    expect(res.body).toMatchObject({ success: false, errors: [] });
    expect(JSON.stringify(res.body)).not.toMatch(/stack/i);
  });

  it('token manipulado → 401', async () => {
    await request(server())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}x`)
      .expect(401);
  });

  it('usuario inactivo con token válido → 401', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      username: 'vendedor',
      isActive: false,
      role: { code: 'SELLER', permissions: [] },
    });
    await request(server()).get('/api/v1/products').set(auth()).expect(401);
  });

  it('GET /products con permiso → 200 con data y pagination', async () => {
    const res = await request(server()).get('/api/v1/products?page=1&limit=10').set(auth()).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ sku: 'GIL-001', salePrice: 25, lowStock: true });
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('parámetros inválidos → 422 con detalle', async () => {
    const res = await request(server()).get('/api/v1/products?page=0').set(auth()).expect(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('sin permiso de escritura (Vendedor) → 403', async () => {
    const res = await request(server())
      .post('/api/v1/products')
      .set(auth())
      .send({ sku: 'X-1', name: 'Algo', salePrice: 5 })
      .expect(403);
    expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('permisos') });
  });

  it('un Vendedor sin users:read no puede listar usuarios → 403', async () => {
    await request(server()).get('/api/v1/users').set(auth()).expect(403);
  });

  it('GET /products/export devuelve CSV (no lo captura la ruta :id)', async () => {
    const res = await request(server()).get('/api/v1/products/export').set(auth()).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('GIL-001');
  });

  it('id que no es UUID → 400/422 en vez de error interno', async () => {
    const res = await request(server()).get('/api/v1/products/no-es-uuid').set(auth());
    expect([400, 422]).toContain(res.status);
  });

  it('login con cuerpo vacío → 422 (y no 500)', async () => {
    await request(server()).post('/api/v1/auth/login').send({}).expect(422);
  });

  // ───────────── Fases 9–14 ─────────────

  /** Simula que el usuario autenticado tiene exactamente estos permisos en la próxima petición. */
  const asUser = (role: string, perms: string[]) =>
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      username: 'x',
      isActive: true,
      role: { code: role, permissions: perms.map((code) => ({ permission: { code } })) },
    });

  it('inventario: sin inventory:write no se registran movimientos → 403', async () => {
    asUser('SELLER', ['inventory:read']);
    await request(server())
      .post('/api/v1/inventory/movements')
      .set(auth())
      .send({ productId: '11111111-1111-4111-8111-111111111111', type: 'ENTRY', quantity: 1, unitCost: 5 })
      .expect(403);
  });

  it('inventario: una entrada sin costo → 422 con detalle', async () => {
    asUser('INVENTORY_MANAGER', ['inventory:write']);
    const res = await request(server())
      .post('/api/v1/inventory/movements')
      .set(auth())
      .send({ productId: '11111111-1111-4111-8111-111111111111', type: 'ENTRY', quantity: 1 })
      .expect(422);
    expect(JSON.stringify(res.body.errors)).toMatch(/costo/i);
  });

  it('inventario: una salida sin motivo → 400 con el campo note', async () => {
    asUser('INVENTORY_MANAGER', ['inventory:write']);
    const res = await request(server())
      .post('/api/v1/inventory/movements')
      .set(auth())
      .send({ productId: '11111111-1111-4111-8111-111111111111', type: 'EXIT', quantity: 1 })
      .expect(400);
    expect(res.body.errors[0].field).toBe('note');
  });

  it('clientes: listado con permiso → 200 y paginación', async () => {
    asUser('SELLER', ['customers:read']);
    const res = await request(server()).get('/api/v1/customers').set(auth()).expect(200);
    expect(res.body).toMatchObject({ success: true, data: [], pagination: { total: 0 } });
  });

  it('ventas: cuerpo inválido → 422; anular exige sales:void → 403', async () => {
    asUser('SELLER', ['sales:write']);
    await request(server()).post('/api/v1/sales').set(auth()).send({ customerId: 'x', items: [] }).expect(422);
    asUser('SELLER', ['sales:write']);
    await request(server())
      .post('/api/v1/sales/11111111-1111-4111-8111-111111111111/void')
      .set(auth())
      .send({ reason: 'motivo suficiente' })
      .expect(403);
  });

  it('cotización: convertir exige quotations:write Y sales:write', async () => {
    asUser('SELLER', ['quotations:write']);
    await request(server())
      .post('/api/v1/quotations/11111111-1111-4111-8111-111111111111/convert')
      .set(auth())
      .send({ paymentMethod: 'CASH' })
      .expect(403);
  });

  it('cuentas por cobrar: /payments/receivables existe (no es un :id) → 200 con resumen', async () => {
    asUser('ACCOUNTING', ['payments:read']);
    const res = await request(server()).get('/api/v1/payments/receivables').set(auth()).expect(200);
    expect(res.body.summary).toMatchObject({ count: 0, totalReceivable: 0, overdueCount: 0, overdueAmount: 0 });
  });

  it('abono: método CREDIT no es un medio de pago válido → 422', async () => {
    asUser('ACCOUNTING', ['payments:write']);
    await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({ saleId: '11111111-1111-4111-8111-111111111111', amount: 10, method: 'CREDIT' })
      .expect(422);
  });

  it('órdenes de servicio: un rol sin el permiso no entra → 403', async () => {
    asUser('SELLER', ['customers:read']);
    await request(server()).get('/api/v1/service-orders').set(auth()).expect(403);
  });

  // ───────────── Fases 15–17 ─────────────

  it('catálogo público: sin token → 200, con caché y SIN costos ni stock exacto', async () => {
    const res = await request(server()).get('/api/v1/public/products').expect(200);
    expect(res.headers['cache-control']).toContain('public');
    expect(res.body.success).toBe(true);
    const item = res.body.data[0];
    expect(item).toMatchObject({ sku: 'GIL-001', price: 25, availability: 'LIMITED' });
    for (const k of ['avgCost', 'stock', 'minStock']) expect(item).not.toHaveProperty(k);
  });

  it('catálogo público: límite excesivo → 422', async () => {
    await request(server()).get('/api/v1/public/products?limit=500').expect(422);
  });

  it('solicitar cotización sin sesión → 201; contacto inválido → 422', async () => {
    const ok = await request(server())
      .post('/api/v1/public/inquiries')
      .send({ name: 'Los Pinos', contact: 'compras@lospinos.com', productInterest: 'Boquilla' })
      .expect(201);
    expect(ok.body).toEqual({ success: true, data: { received: true } });
    await request(server()).post('/api/v1/public/inquiries').send({ name: 'X', contact: 'hola' }).expect(422);
  });

  it('las consultas internas exigen sesión y permiso', async () => {
    await request(server()).get('/api/v1/inquiries').expect(401);
    asUser('SELLER', ['customers:read']);
    await request(server()).get('/api/v1/inquiries').set(auth()).expect(403);
  });

  it('auditoría: solo con audit:read (el vendedor no entra)', async () => {
    asUser('SELLER', ['sales:read']);
    await request(server()).get('/api/v1/audit').set(auth()).expect(403);
    asUser('SELLER', ['sales:read']);
    await request(server()).get('/api/v1/audit/export').set(auth()).expect(403);
  });

  it('reportes: catálogo con reports:read; nombre inexistente → 400; sin permiso → 403', async () => {
    asUser('ACCOUNTING', ['reports:read']);
    const res = await request(server()).get('/api/v1/reports').set(auth()).expect(200);
    expect(res.body.data).toHaveLength(11);
    asUser('ACCOUNTING', ['reports:read']);
    await request(server()).get('/api/v1/reports/no-existe').set(auth()).expect(400);
    asUser('SELLER', ['dashboard:read']);
    await request(server()).get('/api/v1/reports/inventory').set(auth()).expect(403);
  });

  it('reportes: fecha mal formada → 422', async () => {
    asUser('ACCOUNTING', ['reports:read']);
    await request(server()).get('/api/v1/reports/payments?from=ayer').set(auth()).expect(422);
  });

  it('reporte exportado: CSV con BOM y cabecera de descarga', async () => {
    asUser('ACCOUNTING', ['reports:read']);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ status: 'CONVERTED', quotations: 1, total: '300' }]);
    const res = await request(server()).get('/api/v1/reports/quotations/export').set(auth()).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('quotations-');
    expect(res.text).toContain('CONVERTED');
  });

  it('dashboard: /dashboard/summary con datos del servidor, por permisos', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    asUser('TECHNICIAN', ['dashboard:read', 'service-orders:read']);
    const res = await request(server()).get('/api/v1/dashboard/summary').set(auth()).expect(200);
    expect(res.body.data).toMatchObject({ sales: null, inventory: null, serviceOrders: { open: 0 }, alerts: [] });
    prismaMock.$queryRaw.mockResolvedValue([1]);
  });
});
