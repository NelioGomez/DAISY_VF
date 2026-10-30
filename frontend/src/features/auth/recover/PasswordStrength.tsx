import { STRENGTH_LABEL, passwordRules, passwordStrength } from '../../../utils/passwordPolicy';
import { CheckIcon } from '../icons';

/** Medidor de fuerza y lista de requisitos que se marcan mientras se escribe. */
export function PasswordStrength({ password, username }: { password: string; username: string }) {
  const level = passwordStrength(password, username);
  // Sin nombre de usuario (registro de clientes) no se muestra esa regla.
  const rules = passwordRules(password, username).filter((r) => r.id !== 'username' || username.trim());
  return (
    <>
      <div className="auth-strength" data-level={level} aria-hidden={!password}>
        <i />
        <i />
        <i />
        <i />
        <span aria-live="polite">{password ? STRENGTH_LABEL[level] : ''}</span>
      </div>
      <ul className="auth-rules" aria-label="Requisitos de la contraseña">
        {rules.map((r) => (
          <li key={r.id} className={r.ok ? 'ok' : ''}>
            <span className="auth-rule-mark" aria-hidden="true">
              {r.ok && <CheckIcon size={11} />}
            </span>
            {r.label}
            <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
