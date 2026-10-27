/* =====================================================================
   Inicio de sesión de SIVEN.
   Seguridad del lado del cliente (el backend debe aplicar lo mismo):
   - El rol viene de la cuenta; no se elige en el formulario.
   - Mensaje genérico ante credenciales incorrectas (sin enumerar usuarios).
   - Límite de intentos con bloqueo temporal y cuenta regresiva.
   - La contraseña se borra tras un intento fallido y nunca se recuerda.
   - Cierre por inactividad con aviso y regreso a la vista anterior.
   ===================================================================== */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/feedback/useToast';
import { isModuleId, visibleModules } from '../../config/navigation';
import { REMEMBER_USER_KEY, SHOW_DEMO_ACCOUNTS, USERNAME_MAX } from '../../config/security';
import { ACCESS, MODULE_COUNT, ROLES, ROLE_KEYS } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { SessionUser } from '../../types';
import type { LoginRedirectState } from '../../app/router/guards';
import { AuthLayout } from './AuthLayout';
import { DemoAccounts } from './DemoAccounts';
import { AlertIcon, CheckIcon, InfoIcon, UserIcon } from './icons';
import { PasswordField } from './PasswordField';

type Notice = { tone: 'error' | 'warning' | 'info' | 'success'; text: string } | null;

function readRememberedUser(): string {
  try {
    return localStorage.getItem(REMEMBER_USER_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeRememberedUser(username: string | null): void {
  try {
    if (username) localStorage.setItem(REMEMBER_USER_KEY, username);
    else localStorage.removeItem(REMEMBER_USER_KEY);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/** Ruta a la que se vuelve tras iniciar sesión, si el usuario tiene acceso a ella. */
function destinationFor(user: SessionUser, from?: string): string {
  const allowed = visibleModules(user);
  const mod = from?.match(/^\/app\/([^/]+)/)?.[1];
  if (isModuleId(mod) && allowed.includes(mod)) return `/app/${mod}`;
  return allowed[0] ? `/app/${allowed[0]}` : '/app';
}

const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
import type { RoleKey } from '../../types';
import type { LoginRedirectState } from '../../app/router/guards';
import { AuthLayout } from './AuthLayout';
import { DemoAccounts } from './DemoAccounts';
import { AlertIcon, CheckIcon, InfoIcon, UserIcon } from './icons';
import { PasswordField } from './PasswordField';

type Notice = { tone: 'error' | 'warning' | 'info' | 'success'; text: string } | null;

function readRememberedUser(): string {
  try {
    return localStorage.getItem(REMEMBER_USER_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeRememberedUser(username: string | null): void {
  try {
    if (username) localStorage.setItem(REMEMBER_USER_KEY, username);
    else localStorage.removeItem(REMEMBER_USER_KEY);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/** Ruta a la que se vuelve tras iniciar sesión, si el rol tiene acceso a ella. */
function destinationFor(role: RoleKey, from?: string): string {
  const mod = from?.match(/^\/app\/([^/]+)/)?.[1];
  if (isModuleId(mod) && ACCESS[role].includes(mod)) return `/app/${mod}`;
  return `/app/${ACCESS[role][0]}`;
}

const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function LoginPage() {
  const { user, login, lastLogout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Tras un cierre manual no se vuelve a la vista anterior (puede entrar otra persona).
  const navState = (location.state as LoginRedirectState | null) ?? {};
  const from = lastLogout?.reason === 'manual' ? undefined : navState.from;

  // Tras un cierre por inactividad o un cambio de contraseña se conserva el usuario.
  const [username, setUsername] = useState(
    () => navState.resetUsername ?? (lastLogout && lastLogout.reason !== 'manual' ? lastLogout.username : readRememberedUser()),
  );
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => readRememberedUser() !== '');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [notice, setNotice] = useState<Notice>(() =>
    navState.resetUsername
      ? navState.resetSimulated
        ? { tone: 'info', text: 'Recuperación simulada completada. El servidor aún no tiene este proceso, así que su contraseña real no cambió.' }
        : { tone: 'success', text: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' }
      : lastLogout?.reason === 'idle'
        ? { tone: 'info', text: 'Su sesión se cerró por inactividad. Inicie sesión para continuar donde estaba.' }
        : lastLogout?.reason === 'expired'
          ? { tone: 'info', text: 'Su sesión venció por seguridad. Inicie sesión para continuar donde estaba.' }
          : lastLogout?.reason === 'offline'
            ? { tone: 'warning', text: 'No se pudo conectar con el servidor para recuperar su sesión. Revise su conexión e intente de nuevo.' }
            : null,
  );
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [role, setRole] = useState<RoleKey>('admin');
  const [username, setUsername] = useState(ROLES.admin.user);
  const [password, setPassword] = useState('••••••••');

  // Tras un cierre por inactividad o un cambio de contraseña se conserva el usuario.
  const [username, setUsername] = useState(
    () => navState.resetUsername ?? (lastLogout?.reason === 'idle' ? lastLogout.username : readRememberedUser()),
  );
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => readRememberedUser() !== '');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [notice, setNotice] = useState<Notice>(() =>
    navState.resetUsername
      ? { tone: 'success', text: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' }
      : lastLogout?.reason === 'idle'
        ? { tone: 'info', text: 'Su sesión se cerró por inactividad. Inicie sesión para continuar donde estaba.' }
        : null,
  );
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockedUser, setLockedUser] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  // El servidor limita los intentos por dirección IP, no por usuario.
  const locked = secondsLeft > 0;

  // Foco inicial: usuario vacío → usuario; usuario recordado → contraseña.
  useEffect(() => {
    (username ? passRef : userRef).current?.focus();
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva del bloqueo temporal.
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        clearInterval(t);
        setLockedUntil(0);
        setNotice(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  if (user) return <Navigate to={destinationFor(user, from)} replace />;

  const validate = () => {
    const e: typeof errors = {};
    if (!username.trim()) e.username = 'Escriba su usuario.';
    if (!password) e.password = 'Escriba su contraseña.';
    setErrors(e);
    return e;
  const selectRole = (r: RoleKey) => {
    setRole(r);
    setUsername(ROLES[r].user);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (loading || locked) return;
    const e = validate();
    if (e.username) return userRef.current?.focus();
    if (e.password) return passRef.current?.focus();

    setLoading(true);
    setNotice(null);
    const res = await login(username, password);
    setLoading(false);

    if (res.ok) {
      storeRememberedUser(remember ? res.user.user : null);
      toast('Sesión iniciada como ' + res.user.name, 'ok');
      navigate(destinationFor(res.user, from), { replace: true });
      return;
    }

    setPassword('');
    if (res.code === 'LOCKED') {
      const until = Date.now() + res.retryAfter * 1000;
      setNow(Date.now());
      setLockedUntil(until);
      setNotice({ tone: 'warning', text: res.message });
    } else if (res.code === 'INVALID_CREDENTIALS') {
      // El dato de intentos restantes viene del límite real del servidor (X-RateLimit-Remaining).
      const n = res.remainingAttempts;
      const extra = n === null || n > 2 ? '' : n <= 0 ? ' El siguiente intento fallido bloqueará el acceso por un minuto.' : n === 1 ? ' Le queda 1 intento antes del bloqueo temporal.' : ` Le quedan ${n} intentos antes del bloqueo temporal.`;
      setNotice({ tone: 'error', text: res.message + extra });
    } else {
      setNotice({ tone: res.code === 'NETWORK' ? 'warning' : 'error', text: res.message });
    }
    passRef.current?.focus();
  };

  const pickDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrors({});
    setNotice(null);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Autenticación simulada: la contraseña aún no se valida (se hará con /auth/login en NestJS).
    const u = login(role, username);
    toast('Sesión iniciada como ' + u.name, 'ok');
    navigate(`/app/${ACCESS[role][0]}`);
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Iniciar sesión</h1>
      <p className="auth-sub">Use la cuenta que le asignó el administrador del sistema.</p>

      <div className="auth-notice-slot" aria-live="assertive">
        {notice && (
          <div className={`auth-notice is-${notice.tone}`} role={notice.tone === 'info' || notice.tone === 'success' ? 'status' : 'alert'}>
            {notice.tone === 'info' ? <InfoIcon /> : notice.tone === 'success' ? <CheckIcon /> : <AlertIcon />}
            <div>
              {notice.text}
              {locked && (
                <>
                  {' '}
                  Podrá intentarlo de nuevo en <strong>{formatCountdown(secondsLeft)}</strong>.
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className={`auth-field ${errors.username ? 'has-error' : ''}`}>
          <label htmlFor="username">Usuario</label>
          <div className="auth-input">
            <span className="auth-input-icon">
              <UserIcon />
            </span>
            <input
              ref={userRef}
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              value={username}
              disabled={loading}
              aria-invalid={!!errors.username}
              aria-describedby="username-msg"
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((s) => ({ ...s, username: undefined }));
              }}
            />
          </div>
          <div id="username-msg" className="auth-field-msg">
            {errors.username && <span className="auth-error-text">{errors.username}</span>}
          </div>
        </div>

        <PasswordField
          ref={passRef}
          value={password}
          disabled={loading}
          error={errors.password}
          onChange={(v) => {
            setPassword(v);
            if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
          }}
        />

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Recordar mi usuario</span>
          </label>
          <Link to="/recuperar" className="auth-link">
            ¿Olvidó su contraseña?
          </Link>
        </div>

        <button type="submit" className="auth-submit" disabled={loading || locked} aria-busy={loading}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Verificando…' : locked ? `Bloqueado ${formatCountdown(secondsLeft)}` : 'Iniciar sesión'}
        </button>
      </form>

      {SHOW_DEMO_ACCOUNTS && <DemoAccounts onPick={pickDemo} />}
    </AuthLayout>
  );
}
