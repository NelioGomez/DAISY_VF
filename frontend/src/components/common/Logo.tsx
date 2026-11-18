import type { CSSProperties } from 'react';

type LogoVariant = 'default' | 'sidebar' | 'invoice';

const STYLES: Record<LogoVariant, { mark?: CSSProperties; b?: CSSProperties; span?: CSSProperties }> = {
  default: {},
  sidebar: { mark: { width: 38, height: 38, fontSize: 20, borderRadius: 9 }, b: { fontSize: 17 }, span: { fontSize: 9 } },
  invoice: { mark: { width: 36, height: 36, fontSize: 18 }, b: { color: 'var(--ink)', fontSize: 16 }, span: { color: 'var(--amber-deep)' } },
};

export function Logo({ variant = 'default' }: { variant?: LogoVariant }) {
  const s = STYLES[variant];
  return (
    <div className="logo">
      <div className="mark" style={s.mark}>
        N
      </div>
      <div className="name">
        <b style={s.b}>NORCOR</b>
        <span style={s.span}>Fueling System</span>
      </div>
    </div>
  );
}
