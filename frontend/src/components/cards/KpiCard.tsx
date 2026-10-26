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
      <div className="val">{val}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
