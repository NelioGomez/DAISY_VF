/* Paso 2: el usuario escribe el código de 6 dígitos que recibió por correo. */
import { useEffect, useState } from 'react';
import { RESET_CODE_LENGTH } from '../../../config/security';
import { maskEmail, verifyResetCode } from '../../../services/auth/recoveryService';
import { AlertIcon } from '../icons';
import { OtpInput } from './OtpInput';

interface StepCodeProps {
  email: string;
  expiresAt: number;
  resendAt: number;
  devCode?: string;
  devNoAccount?: boolean;
  onVerified(resetToken: string, username: string): void;
  onResend(): Promise<string | null>;
  onAttemptsExhausted(): void;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const empty = () => Array.from({ length: RESET_CODE_LENGTH }, () => '');

export function StepCode({ email, expiresAt, resendAt, devCode, devNoAccount, onVerified, onResend, onAttemptsExhausted }: StepCodeProps) {
  const [digits, setDigits] = useState<string[]>(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresIn = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = expiresIn === 0;

  const verify = async (code = digits.join('')) => {
    if (loading || expired) return;
    if (code.length < RESET_CODE_LENGTH) return setError(`Escriba los ${RESET_CODE_LENGTH} dígitos del código.`);
    setLoading(true);
    setError('');
    const res = await verifyResetCode(email, code);
    setLoading(false);
    if (res.ok) return onVerified(res.resetToken, res.username);
    setDigits(empty());
    if (res.code === 'INVALID_CODE') {
      const n = res.remainingAttempts;
      setError(`${res.message} ${n === 1 ? 'Le queda 1 intento.' : `Le quedan ${n} intentos.`}`);
      document.querySelector<HTMLInputElement>('.auth-otp input')?.focus();
    } else if (res.code === 'TOO_MANY_ATTEMPTS') {
      onAttemptsExhausted();
    } else {
      setError(res.message);
    }
  };

  const resend = async () => {
    setResending(true);
    const err = await onResend();
    setResending(false);
    if (err) setError(err);
  };

  return (
    <>
      <h1 className="auth-title">Revise su correo</h1>
      <p className="auth-sub">
        Si <strong>{maskEmail(email)}</strong> pertenece a una cuenta, le llegará un código de {RESET_CODE_LENGTH} dígitos. Revise también la carpeta de
        spam.
      </p>

      <div className="auth-notice-slot" aria-live="assertive">
        {(error || expired) && (
          <div className="auth-notice is-error" role="alert">
            <AlertIcon />
            <div>{expired ? 'El código venció. Pida uno nuevo para continuar.' : error}</div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        noValidate
      >
        <OtpInput
          value={digits}
          onChange={(v) => {
            setDigits(v);
            if (error) setError('');
          }}
          onComplete={(code) => void verify(code)}
          disabled={loading || expired}
          invalid={!!error}
          describedBy="otp-meta"
        />

        <div id="otp-meta" className="auth-otp-meta">
          <span>{expired ? 'Código vencido' : <>El código vence en <strong>{clock(expiresIn)}</strong></>}</span>
          <button type="button" className="auth-link" onClick={resend} disabled={resendIn > 0 || resending}>
            {resending ? 'Enviando…' : resendIn > 0 ? `Reenviar en ${clock(resendIn)}` : 'Reenviar código'}
          </button>
        </div>

        <button type="submit" className="auth-submit" disabled={loading || expired} aria-busy={loading}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Verificando…' : 'Verificar código'}
        </button>
      </form>

      {(devCode || devNoAccount) && (
        <div className="auth-devbox" role="note">
          <b>Modo prueba.</b> El envío real del correo lo hará el backend; mientras tanto el código se muestra aquí. Esta caja no aparece fuera de
          desarrollo.
          {devCode ? (
            <div className="auth-devbox-code">
              <span>{devCode}</span>
              <button type="button" onClick={() => void verify(devCode)} disabled={loading || expired}>
                Usar código
              </button>
            </div>
          ) : (
            <p style={{ marginTop: 8 }}>Este correo no pertenece a ninguna cuenta de prueba, así que no se generó un código válido.</p>
          )}
        </div>
      )}
    </>
  );
}
