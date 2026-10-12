/** Prisma devuelve Decimal (objeto); la API expone números simples. */
export function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}