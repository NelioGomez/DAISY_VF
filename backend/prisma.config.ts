import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: la conexión y el seed se configuran aquí (ya no en schema.prisma).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
