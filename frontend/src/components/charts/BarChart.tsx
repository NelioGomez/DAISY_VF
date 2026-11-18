import { money, num } from '../../utils/format';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  fmt?: (n: number) => string;
}

export function BarChart({ data, fmt }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * 100);
        return (
          <div className="bar" key={d.label + i}>
            <div className="v">{d.value ? (fmt ? fmt(d.value) : num(d.value)) : ''}</div>
            <div className="col" style={{ height: (d.value ? Math.max(h, 3) : 0) + '%' }} title={`${d.label}: ${money(d.value)}`} />
            <div className="cap">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
