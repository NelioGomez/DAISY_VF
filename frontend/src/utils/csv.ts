/* Exportación CSV (RF-23). Incluye BOM para que Excel respete los acentos. */

export type CsvRow = Array<string | number | null | undefined>;

export function exportCSV(filename: string, rows: CsvRow[]): void {
  const csv = rows
    .map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
