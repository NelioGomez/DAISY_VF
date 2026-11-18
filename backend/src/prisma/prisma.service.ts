import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/** Parámetros de sesión de PostgreSQL para toda conexión de la API (y del seed). */
export const PG_SESSION_OPTIONS = '-c TimeZone=UTC';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
        // Sesión en UTC: las columnas TIMESTAMPTZ se leen sin desfase aunque el servidor de
        // PostgreSQL tenga otra zona (en Windows suele quedar America/Managua). Ver docs/base-de-datos.md.
        options: PG_SESSION_OPTIONS,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
