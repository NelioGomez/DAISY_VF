/** Prisma devuelve Decimal (objeto); la API expone números simples. con brillitos :3 */
export function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}