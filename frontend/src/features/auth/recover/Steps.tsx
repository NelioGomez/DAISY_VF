import { CheckIcon } from '../icons';

const STEPS = ['Correo', 'Código', 'Nueva contraseña'];

/** Indicador de los 3 pasos de la recuperación. */
export function Steps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="auth-steps" aria-label={`Paso ${current + 1} de ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
        return (
          <li key={label} className={state} aria-current={i === current ? 'step' : undefined}>
            <span className="auth-step-label">
              {i < current && <CheckIcon size={14} />}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
