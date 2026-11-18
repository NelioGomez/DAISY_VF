import type { ReactNode } from 'react';

interface ViewHeadProps {
  title: string;
  desc: string;
  actions?: ReactNode;
}

export function ViewHead({ title, desc, actions }: ViewHeadProps) {
  return (
    <div className="view-head">
      <div className="vh-txt">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className="vh-actions">{actions}</div>
    </div>
  );
}
