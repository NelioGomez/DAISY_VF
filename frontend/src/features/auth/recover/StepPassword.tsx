/* Paso 3: el usuario crea su contraseña nueva. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { resetPassword } from '../../../services/auth/recoveryService';
import { meetsPolicy } from '../../../utils/passwordPolicy';
import { AlertIcon } from '../icons';
import { PasswordField } from '../PasswordField';
import { PasswordStrength } from './PasswordStrength';

interface StepPasswordProps {
  resetToken: string;
  username: string;
  onDone(username: string): void;
  onExpired(message: string): void;
}

export function StepPassword({ resetToken, username, onDone, onExpired }: StepPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const valid = meetsPolicy(password, username);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = valid && confirm === password && !loading;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouchedConfirm(true);
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    const res = await resetPassword(resetToken, password);
    setLoading(false);
    if (res.ok) return onDone(res.username);
    if (res.code === 'TOKEN_EXPIRED') return onExpired(res.message);
    setError(res.message);
  };

  return (
    <>
      <h1 className="auth-title">Cree una contraseña nueva</h1>
      <p className="auth-sub">
        Para la cuenta <strong>{username}</strong>. Al guardarla, la contraseña anterior deja de funcionar.
      </p>

      <div className="auth-notice-slot" aria-live="assertive">
        {error && (
          <div className="auth-notice is-error" role="alert">
            <AlertIcon />
            <div>{error}</div>
          </div>
        )}
      </div>

      <form onSubmit={submit} noValidate>
        {/* Campo oculto para que el gestor de contraseñas asocie la nueva clave al usuario correcto */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />

        <PasswordField ref={ref} id="new-password" label="Nueva contraseña" autoComplete="new-password" value={password} onChange={setPassword} disabled={loading} />
        <PasswordStrength password={password} username={username} />

        <PasswordField
          id="confirm-password"
          label="Confirmar contraseña"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          onBlur={() => setTouchedConfirm(true)}
          disabled={loading}
          error={touchedConfirm && mismatch ? 'Las contraseñas no coinciden.' : undefined}
        />

        <button type="submit" className="auth-submit" disabled={!canSubmit} aria-busy={loading} style={{ marginTop: 6 }}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </>
  );
}
