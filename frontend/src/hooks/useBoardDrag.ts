/* Arrastrar y soltar tarjetas entre columnas de un tablero (mejora n.° 58), sin librerías:
   eventos de puntero, que sirven igual para mouse, lápiz y pantalla táctil.
   - Con mouse se arrastra la tarjeta desde cualquier punto (salvo botones y enlaces) después de
     moverla unos píxeles; un clic normal sigue abriendo el registro.
   - En pantallas táctiles se arrastra desde la manija ⠿ de la tarjeta; el resto de la tarjeta
     sigue desplazando la página.
   - Cerca de los bordes el tablero se desplaza solo; Esc cancela el arrastre. */
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** Distancia (px) que debe moverse el mouse para que empiece el arrastre. */
const DRAG_PX = 5;
/** Franja (px) junto a los bordes que desplaza el tablero o la página. */
const EDGE = 56;
/** Velocidad (px por cuadro) según qué tan cerca del borde está el puntero: más cerca, más rápido. */
const speed = (dist: number) => {
  const r = Math.min(1, Math.max(0, (EDGE - dist) / EDGE));
  return Math.round(2 + 10 * r * r);
};

export interface BoardDragOptions<C extends string> {
  /** Contenedor con desplazamiento horizontal (las columnas). */
  scrollRef: RefObject<HTMLElement | null>;
  canDrop(id: string, from: C, to: C): boolean;
  onDrop(id: string, from: C, to: C): void;
  /** Se soltó en una columna que no admite la tarjeta. */
  onInvalid?(id: string, from: C, to: C): void;
}

export interface BoardDrag<C extends string> {
  /** Tarjeta que se está arrastrando. */
  active: { id: string; from: C; width: number; x: number; y: number } | null;
  /** Columna bajo el puntero. */
  over: C | null;
  /** Elemento que sigue al puntero (copia de la tarjeta). */
  ghostRef: RefObject<HTMLDivElement | null>;
  /** Propiedades para cada tarjeta arrastrable. */
  cardProps(
    id: string,
    from: C,
  ): {
    onPointerDown(e: ReactPointerEvent<HTMLElement>): void;
    onClickCapture(e: MouseEvent<HTMLElement>): void;
  };
}

export function useBoardDrag<C extends string>(options: BoardDragOptions<C>): BoardDrag<C> {
  const [active, setActive] = useState<BoardDrag<C>['active']>(null);
  const [over, setOver] = useState<C | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const opts = useRef(options);
  const suppressClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    opts.current = options;
  });
  // Si la pantalla se desmonta en medio de un arrastre, se quitan los oyentes.
  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, id: string, from: C) => {
    if (cleanup.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const onGrip = !!target.closest('[data-grip]');
    if (!onGrip && target.closest('button, a, input, select, textarea, label, [data-nodrag]')) return;
    if (e.pointerType !== 'mouse' && !onGrip) return;

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const pointerId = e.pointerId;
    const sx = e.clientX;
    const sy = e.clientY;
    const offX = sx - rect.left;
    const offY = sy - rect.top;
    let x = sx;
    let y = sy;
    let dragging = false;
    let current: C | null = null;
    let frame = 0;

    const columnAt = (px: number, py: number): C | null => {
      const el = document.elementFromPoint(px, py) as HTMLElement | null;
      return (el?.closest('[data-col]')?.getAttribute('data-col') as C | null | undefined) ?? null;
    };
    const place = () => {
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${x - offX}px, ${y - offY}px) rotate(1.5deg)`;
    };
    const tick = () => {
      const sc = opts.current.scrollRef.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (x < r.left + EDGE) sc.scrollLeft -= speed(x - r.left);
        else if (x > r.right - EDGE) sc.scrollLeft += speed(r.right - x);
      }
      if (y < 80) window.scrollBy(0, -speed(y - 24));
      else if (y > window.innerHeight - EDGE) window.scrollBy(0, speed(window.innerHeight - y));
      const col = columnAt(x, y);
      if (col !== current) {
        current = col;
        setOver(col);
      }
      place();
      frame = requestAnimationFrame(tick);
    };
    const begin = () => {
      dragging = true;
      current = from;
      setOver(from);
      setActive({ id, from, width: rect.width, x: rect.left, y: rect.top });
      document.body.classList.add('is-board-dragging');
      frame = requestAnimationFrame(tick);
    };
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      cleanup.current = null;
      cancelAnimationFrame(frame);
      if (!dragging) return;
      document.body.classList.remove('is-board-dragging');
      // El clic que sigue al soltar no debe abrir la tarjeta.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setActive(null);
      setOver(null);
      if (!commit) return;
      const to = columnAt(x, y);
      if (!to || to === from) return;
      if (opts.current.canDrop(id, from, to)) opts.current.onDrop(id, from, to);
      else opts.current.onInvalid?.(id, from, to);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      x = ev.clientX;
      y = ev.clientY;
      if (!dragging) {
        if (Math.hypot(x - sx, y - sy) < DRAG_PX) return;
        begin();
      }
      ev.preventDefault();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) finish(true);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) finish(false);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      finish(false);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    cleanup.current = () => finish(false);
  }, []);

  const cardProps = useCallback(
    (id: string, from: C) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, id, from),
      onClickCapture: (e: MouseEvent<HTMLElement>) => {
        if (!suppressClick.current) return;
        e.preventDefault();
        e.stopPropagation();
      },
    }),
    [start],
  );

  return { active, over, ghostRef, cardProps };
}
