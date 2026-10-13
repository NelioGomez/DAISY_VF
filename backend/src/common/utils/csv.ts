export type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/**
 * Convierte filas a CSV listo para Excel (BOM UTF-8, saltos CRLF).
 * Neutraliza "CSV injection": un texto que empiece con = + - @ se prefija con
 * apóstrofo para que Excel no lo ejecute como fórmula.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';

  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  else if (typeof value === 'boolean') text = value ? 'Sí' : 'No';
  else text = value;

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}