/* Selector de tema (mejora n.° 63): claro, oscuro o el del sistema. Un botón con el ícono del
   tema actual abre un menú pequeño; se cierra con Esc, al elegir o al hacer clic afuera. */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTema, type TemaPreferencia } from '../../theme/theme';
import { Icon, type IconName } from './Icon';

const OPCIONES: Array<{ id: TemaPreferencia; label: string; ic: IconName }> = [
  { id: 'claro', label: 'Claro', ic: 'sun' },
  { id: 'oscuro', label: 'Oscuro', ic: 'moon' },
  { id: 'sistema', label: 'Como el sistema', ic: 'monitor' },
];

export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const { preferencia, tema, cambiar } = useTema();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const elegir = (p: TemaPreferencia) => {
    cambiar(p);
    setOpen(false);
    btn.current?.focus();
  };
  const actual = OPCIONES.find((o) => o.id === preferencia)!;

  // Flechas, Inicio y Fin recorren las opciones del menú.
  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div className="theme-toggle" ref={box}>
      <button
        ref={btn}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={`Tema: ${actual.label.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={preferencia === 'sistema' ? (tema === 'dark' ? 'moon' : 'sun') : actual.ic} label={`Tema: ${actual.label.toLowerCase()}`} />
      </button>
      {open && (
        <div className="theme-menu" role="menu" id={menuId} aria-label="Tema de la pantalla" onKeyDown={onMenuKey}>
          {OPCIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={preferencia === o.id}
              className={preferencia === o.id ? 'is-on' : ''}
              onClick={() => elegir(o.id)}
            >
              <Icon name={o.ic} size={16} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
