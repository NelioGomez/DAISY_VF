import { forwardRef, useState, type KeyboardEvent } from 'react';
import { PASSWORD_MAX } from '../../config/security';
import { AlertIcon, EyeIcon, EyeOffIcon, LockIcon } from './icons';

interface PasswordFieldProps {
  value: string;
  onChange(value: string): void;
  onBlur?(): void;
  error?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  /** "current-password" en el login, "new-password" al crear una nueva. */
  autoComplete?: 'current-password' | 'new-password';
}

/** Contraseña con botón mostrar/ocultar y aviso de Bloq Mayús. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { value, onChange, onBlur, error, disabled, id = 'password', label = 'Contraseña', autoComplete = 'current-password' },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  const hintId = `${id}-hint`;
  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        <span className="auth-input-icon">
          <LockIcon />
        </span>
        <input
          ref={ref}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={PASSWORD_MAX}
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error || capsLock ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => {
            setCapsLock(false);
            onBlur?.();
          }}
        />
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <div id={hintId} className="auth-field-msg" aria-live="polite">
        {error ? (
          <span className="auth-error-text">{error}</span>
        ) : capsLock ? (
          <span className="auth-caps">
            <AlertIcon /> Bloq Mayús está activado
          </span>
        ) : null}
      </div>
    </div>
  );
});
