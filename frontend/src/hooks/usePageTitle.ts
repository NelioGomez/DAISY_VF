import { useEffect } from 'react';

/** Título de la pestaña del navegador para las páginas del sitio público. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | NORCOR Fueling System` : 'NORCOR Fueling System';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
