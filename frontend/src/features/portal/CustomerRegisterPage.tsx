/* Registro de clientes (mejora n.° 42): crea la ficha del cliente y su cuenta de acceso
   e inicia sesión. Después vuelve a donde estaba (por ejemplo, a enviar su lista). */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/feedback/useToast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ApiError, errorMessage } from '../../services/api/client';
import type { RegistroInput } from '../../services/portal/portalService';
import { meetsPolicy } from '../../utils/passwordPolicy';
import { PasswordField } from '../auth/PasswordField';
import { PasswordStrength } from '../auth/recover/PasswordStrength';
import { TextField } from '../public/TextField';
import type { CustomerRedirectState } from './customerContext';
import { useCustomer, useQuoteList } from './useCustomer';

type FieldName = keyof RegistroInput | 'confirmar';
const API_FIELD: Record<string, FieldName> = {
  companyName: 'empresa',
  ruc: 'ruc',
  contactName: 'contacto',
  email: 'email',
  phone: 'telefono',
  password: 'password',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function CustomerRegisterPage() {
  usePageTitle('Crear cuenta');
  const { cuenta, registrar } = useCustomer();
  const lista = useQuoteList();
  const toast = useToast();
  const navigate = useNavigate();
  const nav = (useLocation().state as CustomerRedirectState | null) ?? {};
  const destino = nav.from && !nav.from.startsWith('/clientes/ingresar') && !nav.from.startsWith('/clientes/registro') ? nav.from : '/clientes/cuenta';

  const [d, setD] = useState<RegistroInput & { confirmar: string }>({ empresa: '', ruc: '', contacto: '', email: '', telefono: '', password: '', confirmar: '' });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: FieldName) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  if (cuenta) return <Navigate to={destino} replace />;

  const validate = () => {
    const e: Partial<Record<FieldName, string>> = {};
    if (!d.empresa.trim()) e.empresa = 'Escriba el nombre de la empresa o su nombre completo.';
    if (d.ruc.trim() && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(d.ruc.trim())) e.ruc = 'El RUC solo admite letras, números y guiones.';
    if (!d.contacto.trim()) e.contacto = 'Escriba el nombre de la persona de contacto.';
    if (!EMAIL_RE.test(d.email.trim())) e.email = 'Escriba un correo válido; lo usará para iniciar sesión.';
    if (d.telefono.trim() && !/^[0-9+()\-\s.]{6,40}$/.test(d.telefono.trim())) e.telefono = 'Escriba solo números, espacios, guiones o el signo +.';
    if (!meetsPolicy(d.password)) e.password = 'La contraseña todavía no cumple los requisitos.';
    if (!d.confirmar) e.confirmar = 'Repita la contraseña.';
    else if (d.confirmar !== d.password) e.confirmar = 'Las contraseñas no coinciden.';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (loading) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`rg-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await registrar(d);
      if (nav.abrirLista) lista.setAbierta(true);
      toast('Cuenta creada. ¡Bienvenido!', 'ok');
      navigate(destino, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) {
        const byField: Partial<Record<FieldName, string>> = {};
        err.errors.forEach((x) => {
          const f = x.field ? API_FIELD[x.field] : undefined;
          if (f && !byField[f]) byField[f] = x.message;
        });
        setErrors(byField);
        if (!Object.keys(byField).length) setError(err.userMessage);
      } else {
        setError(err instanceof ApiError && err.status === 429 ? 'Se crearon demasiadas cuentas desde su conexión. Intente de nuevo más tarde.' : errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pub-authpage">
      <div className="pub-authcard is-wide">
        <h1>Crear cuenta de cliente</h1>
        <p className="pub-muted">Con su cuenta envía listas de cotización y consulta sus solicitudes y cotizaciones en línea.</p>
        {nav.abrirLista && lista.lineas.length > 0 && (
          <p className="pub-notice is-info">Al terminar volverá a su lista de cotización para enviarla.</p>
        )}

        <form onSubmit={submit} noValidate>
          <fieldset className="pub-fieldset">
            <legend>Empresa</legend>
            <TextField id="rg-empresa" label="Empresa o razón social" value={d.empresa} onChange={set('empresa')} error={errors.empresa} autoComplete="organization" maxLength={200} />
            <TextField
              id="rg-ruc"
              label="RUC o cédula (opcional)"
              value={d.ruc}
              onChange={set('ruc')}
              error={errors.ruc}
              maxLength={30}
              help="Si su empresa ya compra en NORCOR, escríbalo para identificarla."
            />
          </fieldset>
          <fieldset className="pub-fieldset">
            <legend>Persona de contacto</legend>
            <div className="pub-two">
              <TextField id="rg-contacto" label="Nombre completo" value={d.contacto} onChange={set('contacto')} error={errors.contacto} autoComplete="name" maxLength={120} />
              <TextField id="rg-telefono" label="Teléfono (opcional)" type="tel" value={d.telefono} onChange={set('telefono')} error={errors.telefono} autoComplete="tel" maxLength={40} />
            </div>
          </fieldset>
          <fieldset className="pub-fieldset">
            <legend>Acceso</legend>
            <TextField id="rg-email" label="Correo electrónico" type="email" value={d.email} onChange={set('email')} error={errors.email} autoComplete="email" maxLength={150} help="Con este correo iniciará sesión." />
            <PasswordField id="rg-password" label="Contraseña" value={d.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
            <PasswordStrength password={d.password} username="" />
            <PasswordField id="rg-confirmar" label="Repita la contraseña" value={d.confirmar} onChange={set('confirmar')} error={errors.confirmar} autoComplete="new-password" />
          </fieldset>
          {error && (
            <p className="pub-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="pub-btn pub-btn-amber is-block is-big" disabled={loading} aria-busy={loading}>
            {loading ? 'Creando su cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="pub-authalt">
          ¿Ya tiene cuenta? <Link to="/clientes/ingresar" state={nav}>Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
