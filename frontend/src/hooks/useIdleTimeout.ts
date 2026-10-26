import { useEffect, useRef } from 'react';

const EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

/**
 * Ejecuta `onIdle` cuando pasan `minutes` sin actividad del usuario.
 * Revisa cada 15 s en lugar de reprogramar un temporizador por cada evento.
 */
export function useIdleTimeout(minutes: number, onIdle: () => void, enabled = true): void {
  const last = useRef(0);
  const cb = useRef(onIdle);

  useEffect(() => {
    cb.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    const mark = () => {
      last.current = Date.now();
    };
    EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last.current >= minutes * 60_000) cb.current();
    }, 15_000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, [minutes, enabled]);
}
