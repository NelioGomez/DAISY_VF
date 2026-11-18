import type { CSSProperties, ReactNode } from 'react';

interface SearchToolbarProps {
  value: string;
  onChange(value: string): void;
  placeholder: string;
  searchStyle?: CSSProperties;
  children?: ReactNode;
}

export function SearchToolbar({ value, onChange, placeholder, searchStyle, children }: SearchToolbarProps) {
  return (
    <div className="toolbar">
      <div className="search" style={searchStyle}>
        <input value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
      {children}
    </div>
  );
}
