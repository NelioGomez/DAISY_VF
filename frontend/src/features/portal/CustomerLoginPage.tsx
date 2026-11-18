/* Inicio de sesión de clientes (mejora n.° 42). Separado visualmente del acceso
   interno: vive dentro del sitio público y usa otra sesión (token tipo "customer"). */
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/feedback/useToast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ApiError, errorMessage } from '../../services/api/client';
import { PasswordField } from '../auth/PasswordField';
import { TextField } from '../public/TextField';
import type { CustomerRedirectState } from './customerContext';
import { useCustomer, useQuoteList } from './useCustomer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function CustomerLoginPage() {
  usePageTitle('Iniciar sesión');
  const { cuenta, ingresar } = useCustomer();
  const lista = useQuoteList();
  const toast = useToast();
  const navigate = useNavigate();
  const nav = (useLocation().state as CustomerRedirectState | null) ?? {};
  const destino = nav.from && !nav.from.startsWith('/clientes/ingresar') && !nav.from.startsWith('/clientes/registro') ? nav.from : '/clientes/cuenta';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  if (cuenta) return <Navigate to={destino} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Escriba el correo con el que creó su cuenta.';
    if (!password) errs.password = 'Escriba su contraseña.';
    setErrors(errs);
    if (errs.email || errs.password) return;
    setLoading(true);
    setError('');
    try {
      await ingresar(email, password);
      if (nav.abrirLista) lista.setAbierta(true);
      toast('Sesión iniciada', 'ok');
      navigate(destino, { replace: true });
    } catch (err) {
      setPassword('');
      passRef.current?.focus();
      setError(
        err instanceof ApiError && err.status === 401
          ? 'El correo o la contraseña no coinciden. Revise los datos e intente de nuevo.'
          : err instanceof ApiError && err.status === 429
            ? 'Demasiados intentos seguidos. Espere un minuto e intente de nuevo.'
            : errorMessage(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const unidades = lista.lineas.length;

  return (
    <div className="pub-authpage">
      <div className="pub-authcard">
        <h1>Iniciar sesión</h1>
        <p className="pub-muted">Su cuenta de cliente para enviar listas de cotización y seguir sus solicitudes.</p>

        {nav.vencida ? (
          <p className="pub-notice is-info">Su sesión venció por seguridad. Inicie sesión de nuevo para continuar.</p>
        ) : nav.abrirLista && unidades > 0 ? (
          <p className="pub-notice is-info">
            Inicie sesión para enviar su lista de {unidades} {unidades === 1 ? 'producto' : 'productos'}. La lista no se pierde.
          </p>
        ) : null}

        <form onSubmit={submit} noValidate>
          <TextField id="cl-email" label="Correo electrónico" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="username" maxLength={150} />
          <PasswordField ref={passRef} id="cl-password" value={password} onChange={setPassword} error={errors.password} />
          {error && (
            <p className="pub-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="pub-btn pub-btn-amber is-block is-big" disabled={loading} aria-busy={loading}>
            {loading ? 'Verificando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="pub-authalt">
          ¿Primera vez? <Link to="/clientes/registro" state={nav}>Crear una cuenta de cliente</Link>
        </p>
        <p className="pub-authhelp">
          ¿Olvidó su contraseña? Escríbanos desde <Link to="/contacto">Contacto</Link> o por WhatsApp y le ayudamos a recuperar el acceso.
        </p>
      </div>
      <p className="pub-authstaff">
        ¿Trabaja en NORCOR? <Link to="/login">Ingrese al sistema interno</Link>
      </p>
    </div>
  );
}
