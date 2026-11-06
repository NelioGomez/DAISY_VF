/* Tablas más anchas que su espacio (laptop, tableta, panel lateral abierto o muchas columnas):
   se marcan con .is-wide para que se desplacen de lado en vez de recortar las últimas columnas
   (mejora n.° 56). Las que caben conservan el encabezado fijo al bajar (n.° 22). */
import { useEffect } from 'react';

export function useWideTables(): void {
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
    const check = (wrap: Element) => {
      const table = wrap.querySelector(':scope > table') as HTMLElement | null;
      wrap.classList.toggle('is-wide', !!table && table.offsetWidth > wrap.clientWidth + 1);
    };
    const resize = new ResizeObserver((entries) => {
      for (const e of entries) {
        const wrap = e.target.closest('.tablewrap');
        if (wrap) check(wrap);
      }
    });
    const seen = new WeakSet<Element>();
    let frame = 0;
    const scan = () => {
      frame = 0;
      document.querySelectorAll('.tablewrap').forEach((wrap) => {
        if (!seen.has(wrap)) {
          seen.add(wrap);
          resize.observe(wrap);
          const table = wrap.querySelector(':scope > table');
          if (table) resize.observe(table);
        }
        check(wrap);
      });
    };
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan);
    });
    scan();
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);
}
