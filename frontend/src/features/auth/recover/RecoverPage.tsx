/* =====================================================================
   Recuperación de contraseña en 3 pasos: correo → código → nueva contraseña.
   Al terminar vuelve al login con aviso de éxito y el usuario precargado.
   ===================================================================== */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { LoginRedirectState } from '../../../app/router/guards';
import { useToast } from '../../../components/feedback/useToast';
import { requestPasswordReset, type RequestResetResponse } from '../../../services/auth/recoveryService';
import { useAuth } from '../../../store/hooks';
import { AuthLayout } from '../AuthLayout';
import { AlertIcon, ArrowLeftIcon } from '../icons';
import { StepCode } from './StepCode';
import { StepEmail } from './StepEmail';
import { StepPassword } from './StepPassword';
import { Steps } from './Steps';

type Sent = Extract<RequestResetResponse, { ok: true }>;

interface CodeState {
  expiresAt: number;
  resendAt: number;
}

const toCodeState = (r: Sent): CodeState => ({
  expiresAt: Date.now() + r.expiresIn * 1000,
  resendAt: Date.now() + r.resendAfter * 1000,
});

export function RecoverPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<CodeState | null>(null);
  const [reset, setReset] = useState<{ token: string; username: string } | null>(null);
  const [restartNotice, setRestartNotice] = useState('');

  if (user) return <Navigate to="/app" replace />;

  const restart = (message: string) => {
    setStep(0);
    setCode(null);
    setReset(null);
    setRestartNotice(message);
  };

  return (
    <AuthLayout>
      <Steps current={step} />

      {restartNotice && step === 0 && (
        <div className="auth-notice is-warning" role="alert" style={{ marginBottom: 18 }}>
          <AlertIcon />
          <div>{restartNotice}</div>
        </div>
      )}

      {step === 0 && (
        <StepEmail
          initialEmail={email}
          onSent={(mail, res) => {
            setEmail(mail);
            setCode(toCodeState(res));
            setRestartNotice('');
            setStep(1);
          }}
        />
      )}

      {step === 1 && code && (
        <StepCode
          key={code.expiresAt /* un código nuevo reinicia las casillas */}
          email={email}
          {...code}
          onVerified={(token, username) => {
            setReset({ token, username });
            setStep(2);
          }}
          onResend={async () => {
            const res = await requestPasswordReset(email);
            if (!res.ok) return res.message;
            setCode(toCodeState(res));
            toast('Le enviamos un código nuevo', 'ok');
            return null;
          }}
          onAttemptsExhausted={() => {
            restart('Se agotaron los intentos para ese código. Pida uno nuevo.');
          }}
        />
      )}

      {step === 2 && reset && (
        <StepPassword
          resetToken={reset.token}
          username={reset.username}
          onExpired={restart}
          onDone={(username) => {
            toast('Contraseña actualizada', 'ok');
            const state: LoginRedirectState = { resetUsername: username };
            navigate('/login', { replace: true, state });
          }}
        />
      )}

      <div className="auth-links">
        <Link to="/login" className="auth-back">
          <ArrowLeftIcon />
          Volver a iniciar sesión
        </Link>
        {step === 1 && (
          <button
            type="button"
            className="auth-back"
            onClick={() => {
              setCode(null);
              setStep(0);
            }}
          >
            Usar otro correo
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
