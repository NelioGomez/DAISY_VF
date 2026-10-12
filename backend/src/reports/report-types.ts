export type ColumnType = 'text' | 'int' | 'money' | 'percent';

export interface ReportColumn {
  key: string;
  header: string;
  type: ColumnType;
}

export type ReportRow = Record<string, string | number | boolean | null>;

export interface ReportResult {
  name: string;
  title: string;
  filters: Record<string, string | number | boolean | null>;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: Record<string, number>;
  /** true si hubo más filas que el límite y la lista se recortó. */
  truncated: boolean;
}