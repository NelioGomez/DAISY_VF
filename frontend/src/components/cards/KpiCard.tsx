import type { ReactNode } from 'react';

interface KpiCardProps {
  lbl: string;
  val: ReactNode;
  sub: ReactNode;
  ic: string;
  tone?: '' | 'warn' | 'good';
}

/** Tarjeta KPI con estilo de lectura digital (firma visual del prototipo). */
export function KpiCard({ lbl, val, sub, ic, tone = '' }: KpiCardProps) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="lbl">
        {ic} {lbl}
      </div>
      {/* Montos largos (C$ 331,045.27) con letra más pequeña para que no se partan en dos líneas. */}
      <div className={`val ${typeof val === 'string' && val.length > 12 ? 'long' : ''}`}>{val}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
