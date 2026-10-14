import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROLES: { code: UserRole; name: string }[] = [
  { code: UserRole.ADMIN, name: 'Administrador' },
  { code: UserRole.MANAGEMENT, name: 'Gerencia' },
  { code: UserRole.SELLER, name: 'Vendedor' },
  { code: UserRole.INVENTORY_MANAGER, name: 'Encargado de Inventario' },
  { code: UserRole.ACCOUNTING, name: 'Contabilidad' },
  { code: UserRole.TECHNICIAN, name: 'Técnico / OPI' },
];

// Permisos = módulo:acción
const MODULES = [
  'dashboard', 'users', 'products', 'categories', 'brands', 'inventory',
  'customers', 'suppliers', 'quotations', 'sales', 'payments',
  'service-orders', 'reports', 'inquiries', 'audit', 'catalog',
];
const ACTIONS = ['read', 'write'];
// Permisos especiales fuera del par read/write (acciones sensibles).
const EXTRA_PERMISSIONS = ['sales:void'];
const ALL_PERMISSIONS = [
  ...MODULES.flatMap((m) => ACTIONS.map((a) => `${m}:${a}`)),
  ...EXTRA_PERMISSIONS,
];

// Matriz inicial de accesos (sección 8 del Prompt Maestro)
const ROLE_ACCESS: Record<UserRole, string[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGEMENT: [
    'dashboard:read', 'reports:read', 'inventory:read', 'sales:read', 'audit:read',
  ],
  SELLER: [
    'dashboard:read', 'customers:read', 'customers:write',
    'quotations:read', 'quotations:write', 'sales:read', 'sales:write',
    'catalog:read', 'catalog:write', 'inquiries:read', 'inquiries:write',
    // Para cotizar necesita ver productos y filtrar por categoría/marca (solo lectura).
    'products:read', 'categories:read', 'brands:read',
  ],
  INVENTORY_MANAGER: [
    'dashboard:read', 'products:read', 'products:write',
    'categories:read', 'categories:write', 'brands:read', 'brands:write',
    'inventory:read', 'inventory:write', 'suppliers:read', 'suppliers:write',
  ],
  ACCOUNTING: [
    'dashboard:read', 'sales:read', 'payments:read', 'payments:write', 'reports:read',
  ],
  TECHNICIAN: ['dashboard:read', 'service-orders:read', 'service-orders:write'],
};

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('Define SEED_ADMIN_PASSWORD (mínimo 12 caracteres) en el .env');
  }

  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: r,
    });
    const perms = await prisma.permission.findMany({
      where: { code: { in: ROLE_ACCESS[r.code] } },
      select: { id: true },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: UserRole.ADMIN } });
  await prisma.user.upsert({
    where: { username: process.env.SEED_ADMIN_USERNAME ?? 'admin' },
    update: {},
    create: {
      username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      firstName: 'Administrador',
      lastName: 'Sistema',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@norcor.local',
      roleId: adminRole.id,
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'TAX_RATE' },
    update: {},
    create: { key: 'TAX_RATE', value: '0.15', description: 'IVA (15%)' },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'CREDIT_TERM_DAYS' },
    update: {},
    create: { key: 'CREDIT_TERM_DAYS', value: '15', description: 'Plazo de crédito por defecto (días)' },
  });

  console.log('Seed completado: roles, permisos, administrador y configuración.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
