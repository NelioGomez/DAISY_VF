/* Vista previa rápida (mejora n.° 34): al detener el cursor sobre un producto o un cliente (o al
   enfocarlo con el teclado) aparece una tarjeta con lo esencial, sin abrir nada. En pantallas
   táctiles no se muestra: un toque abre directamente el panel del registro. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CARD_W = 300;
const CARD_H = 230;
const canHover = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

interface HoverPreviewProps {
  children: ReactNode;
  /** Contenido de la tarjeta; se dibuja solo cuando se muestra. */
  render: () => ReactNode;
  delay?: number;
}

export function HoverPreview({ children, render, delay = 350 }: HoverPreviewProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const id = useId();

  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  const show = (now = false) => {
    window.clearTimeout(timer.current);
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const above = r.bottom + CARD_H + 12 > window.innerHeight && r.top > CARD_H + 12;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8)),
        top: above ? r.top - 8 : r.bottom + 8,
        above,
      });
    };
    if (now) place();
    else timer.current = window.setTimeout(place, delay);
  };

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      className="hp-anchor"
      ref={anchor}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={() => canHover() && show()}
      onMouseLeave={hide}
      onFocus={(e) => e.target !== e.currentTarget && e.target.matches(':focus-visible') && show(true)}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div id={id} role="tooltip" className={`hp-card ${pos.above ? 'above' : ''}`} style={{ left: pos.left, top: pos.top, width: CARD_W }}>
            {render()}
          </div>,
          document.body,
        )}
    </span>
  );
}
