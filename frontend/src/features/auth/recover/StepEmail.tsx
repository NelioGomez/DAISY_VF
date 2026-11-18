/* Paso 1: el usuario escribe el correo de su cuenta. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isValidEmail, requestPasswordReset, type RequestResetResponse } from '../../../services/auth/recoveryService';
import { AlertIcon, MailIcon } from '../icons';

interface StepEmailProps {
  initialEmail: string;
  onSent(email: string, res: Extract<RequestResetResponse, { ok: true }>): void;
}

const fmt = (s: number) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`);

export function StepEmail({ initialEmail, onSent }: StepEmailProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim()) return setError('Escriba su correo.');
    if (!isValidEmail(email)) return setError('Escriba un correo válido, por ejemplo nombre@empresa.com.');
    setError('');
    setNotice('');
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (!res.ok) {
      if (res.code === 'INVALID_EMAIL') return setError(res.message);
      return setNotice(res.message + (res.retryAfter ? ` Podrá intentarlo en ${fmt(res.retryAfter)}.` : ''));
    }
    onSent(email.trim().toLowerCase(), res);
  };

  return (
    <>
      <h1 className="auth-title">Recuperar contraseña</h1>
      <p className="auth-sub">Escriba el correo asociado a su cuenta. Le enviaremos un código de 6 dígitos para crear una contraseña nueva.</p>

      <div className="auth-notice-slot" aria-live="assertive">
        {notice && (
          <div className="auth-notice is-warning" role="alert">
            <AlertIcon />
            <div>{notice}</div>
          </div>
        )}
      </div>

      <form onSubmit={submit} noValidate>
        <div className={`auth-field ${error ? 'has-error' : ''}`}>
          <label htmlFor="recover-email">Correo electrónico</label>
          <div className="auth-input">
            <span className="auth-input-icon">
              <MailIcon />
            </span>
            <input
              ref={ref}
              id="recover-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              maxLength={120}
              placeholder="nombre@empresa.com"
              value={email}
              disabled={loading}
              aria-invalid={!!error}
              aria-describedby="recover-email-msg"
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
            />
          </div>
          <div id="recover-email-msg" className="auth-field-msg">
            {error && <span className="auth-error-text">{error}</span>}
          </div>
        </div>

        <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading} style={{ marginTop: 8 }}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Enviando código…' : 'Enviar código'}
        </button>
      </form>
    </>
  );
}
