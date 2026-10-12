import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

/**
 * Numeración correlativa sin huecos por concurrencia: el upsert con incremento
 * es atómico en PostgreSQL y bloquea la fila hasta que termine la transacción.
 * Debe llamarse DENTRO de la transacción que crea el documento.
 */
@Injectable()
export class DocumentSequenceService {
  async next(tx: Prisma.TransactionClient, key: string, prefix: string, width = 6): Promise<string> {
    const row = (await tx.documentSequence.upsert({
      where: { key },
      update: { lastValue: { increment: 1 } },
      create: { key, lastValue: 1 },
      select: { lastValue: true },
    })) as { lastValue: number };
    return formatDocumentNumber(prefix, row.lastValue, width);
  }
}

export function formatDocumentNumber(prefix: string, n: number, width = 6): string {
  return `${prefix}-${String(n).padStart(width, '0')}`;
}