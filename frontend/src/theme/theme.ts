/* Tema claro u oscuro (mejora n.° 63) del sistema interno, el sitio público y el acceso.
   La preferencia (claro, oscuro o la del sistema operativo) se guarda en este navegador y se
   comparte entre pestañas; "sistema" sigue prefers-color-scheme en vivo. index.html aplica el
   tema antes de pintar para que la página no parpadee en blanco. */
import { useSyncExternalStore } from 'react';

export type TemaPreferencia = 'claro' | 'oscuro' | 'sistema';
export type Tema = 'light' | 'dark';

const KEY = 'siven.tema';
const THEME_COLOR: Record<Tema, string> = { light: '#13283a', dark: '#0e1821' };

const oscuroDelSistema = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

function leer(): TemaPreferencia {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'claro' || v === 'oscuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

let preferencia: TemaPreferencia = leer();
const listeners = new Set<() => void>();

export const resolverTema = (p: TemaPreferencia): Tema => (p === 'oscuro' ? 'dark' : p === 'claro' ? 'light' : oscuroDelSistema() ? 'dark' : 'light');

function aplicar() {
  const tema = resolverTema(preferencia);
  document.documentElement.dataset.theme = tema;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[tema];
  listeners.forEach((l) => l());
}

export function setTemaPreferencia(p: TemaPreferencia) {
  preferencia = p;
  try {
    if (p === 'sistema') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    /* sin almacenamiento: el tema dura hasta recargar */
  }
  aplicar();
}

if (typeof window !== 'undefined') {
  aplicar();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (preferencia === 'sistema') aplicar();
  });
  // Otra pestaña cambió la preferencia.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      preferencia = leer();
      aplicar();
    }
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => `${preferencia}|${resolverTema(preferencia)}`;

export function useTema(): { preferencia: TemaPreferencia; tema: Tema; cambiar: (p: TemaPreferencia) => void } {
  const [p, t] = useSyncExternalStore(subscribe, snapshot, () => 'sistema|light').split('|') as [TemaPreferencia, Tema];
  return { preferencia: p, tema: t, cambiar: setTemaPreferencia };
}
