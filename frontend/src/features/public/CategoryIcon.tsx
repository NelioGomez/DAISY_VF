/* Íconos de línea por categoría para el sitio público (sustituyen a la foto
   mientras el producto no tenga imagen). Se elige por el nombre de la categoría. */
import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  boquilla: (
    <>
      <path d="M3 12h8" />
      <path d="M11 9h9l3 3v3H11z" />
      <path d="M17 15l2.5 8H23L20.5 15" />
      <path d="M13 15v3.5a2.5 2.5 0 0 0 2.5 2.5H18" />
      <path d="M23 12h3a2 2 0 0 1 2 2v13" />
    </>
  ),
  manguera: (
    <>
      <path d="M14 16a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0" />
      <path d="M6 16V6h5" />
      <path d="M11 4v4" />
    </>
  ),
  filtro: (
    <>
      <rect x="9" y="7" width="14" height="21" rx="2" />
      <path d="M13 3.5h6V7h-6z" />
      <path d="M9 12.5h14M9 17.5h14M9 22.5h14" />
    </>
  ),
  dispensador: (
    <>
      <path d="M6 28V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v22" />
      <path d="M4 28h18" />
      <rect x="9" y="8" width="8" height="6" rx="1" />
      <path d="M20 12h3a2 2 0 0 1 2 2v8a2 2 0 0 0 4 0V11l-3-3" />
    </>
  ),
  electric: <path d="M18 3 7 18h8l-2 11 12-16h-8l1-10z" />,
  conector: (
    <>
      <path d="M3 13h7M3 19h7" />
      <rect x="10" y="9.5" width="5" height="13" rx="1" />
      <rect x="17" y="9.5" width="5" height="13" rx="1" />
      <path d="M15 16h2" />
      <path d="M22 13h7M22 19h7" />
    </>
  ),
  bomba: (
    <>
      <rect x="4" y="11" width="17" height="12" rx="2" />
      <path d="M8 11V7.5h9V11" />
      <path d="M21 14h4.5v6H21" />
      <path d="M25.5 17H29" />
      <path d="M8.5 15v4M12.5 15v4M16.5 15v4" />
      <path d="M6 27h13" />
    </>
  ),
  sello: (
    <>
      <ellipse cx="16" cy="16" rx="12.5" ry="7.5" />
      <ellipse cx="16" cy="16" rx="7" ry="3.5" />
    </>
  ),
};

const DEFAULT_ICON = (
  <>
    <path d="M4 10 16 4l12 6v12l-12 6-12-6z" />
    <path d="M4 10l12 6 12-6" />
    <path d="M16 16v12" />
  </>
);

/** Minúsculas y sin tildes ("Eléctrico" → "electrico"). */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export function CategoryIcon({ categoria, size = 48 }: { categoria: string | null | undefined; size?: number }) {
  const key = normalize(categoria ?? '');
  const match = Object.keys(ICONS).find((k) => key.includes(k));
  const icon = match ? ICONS[match] : DEFAULT_ICON;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon}
    </svg>
  );
}
