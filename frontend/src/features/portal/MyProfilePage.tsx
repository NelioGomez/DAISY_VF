/* Mi perfil: datos de la empresa (solo lectura), persona de contacto y contraseña. */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/feedback/useToast';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ApiError, errorMessage } from '../../services/api/client';
import * as portal from '../../services/portal/portalService';
import { meetsPolicy } from '../../utils/passwordPolicy';
import { PasswordField } from '../auth/PasswordField';
import { PasswordStrength } from '../auth/recover/PasswordStrength';
import { TextField } from '../public/TextField';
import { useCustomer } from './useCustomer';
import { useSessionExpired } from './usePortalData';

export function MyProfilePage() {
  usePageTitle('Mi perfil');
  const { cuenta } = useCustomer();
  if (!cuenta) return null;
  return (
    <>
      <div className="pub-portal-title">
        <h2>Mi perfil</h2>
      </div>
      <div className="pub-profile">
        <section className="pub-panel" aria-labelledby="pf-empresa">
          <h3 id="pf-empresa">Empresa</h3>
          <dl className="pub-specs is-stacked">
            <div>
              <dt>Nombre o razón social</dt>
              <dd>{cuenta.cliente.nombre}</dd>
            </div>
            <div>
              <dt>RUC o cédula</dt>
              <dd>{cuenta.cliente.ruc || 'Sin registrar'}</dd>
            </div>
            {cuenta.cliente.direccion && (
              <div>
                <dt>Dirección</dt>
                <dd>{cuenta.cliente.direccion}</dd>
              </div>
            )}
            <div>
              <dt>Correo de acceso</dt>
              <dd>{cuenta.email}</dd>
            </div>
          </dl>
          <p className="pub-muted is-small">
            Para corregir estos datos <Link to="/contacto">escríbanos</Link>: los usamos en sus cotizaciones y facturas.
          </p>
        </section>
        <ContactForm key={`${cuenta.contacto}|${cuenta.telefono}`} />
        <PasswordForm />
      </div>
    </>
  );
}

function ContactForm() {
  const { cuenta, token, actualizarCuenta } = useCustomer();
  const toast = useToast();
  const expired = useSessionExpired();
  const [contacto, setContacto] = useState(cuenta?.contacto ?? '');
  const [telefono, setTelefono] = useState(cuenta?.telefono ?? '');
  const [errors, setErrors] = useState<{ contacto?: string; telefono?: string }>({});
  const [saving, setSaving] = useState(false);
  const changed = contacto.trim() !== (cuenta?.contacto ?? '') || telefono.trim() !== (cuenta?.telefono ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    const errs: typeof errors = {};
    if (!contacto.trim()) errs.contacto = 'Escriba el nombre de la persona de contacto.';
    if (telefono.trim() && !/^[0-9+()\-\s.]{6,40}$/.test(telefono.trim())) errs.telefono = 'Escriba solo números, espacios, guiones o el signo +.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      actualizarCuenta(await portal.actualizarPerfil(token, contacto, telefono));
      toast('Datos de contacto guardados', 'ok');
    } catch (err) {
      if (!expired(err)) toast(errorMessage(err), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pub-panel" aria-labelledby="pf-contacto">
      <h3 id="pf-contacto">Persona de contacto</h3>
      <form onSubmit={submit} noValidate>
        <TextField id="pf-nombre" label="Nombre completo" value={contacto} onChange={setContacto} error={errors.contacto} autoComplete="name" maxLength={120} />
        <TextField id="pf-telefono" label="Teléfono" type="tel" value={telefono} onChange={setTelefono} error={errors.telefono} autoComplete="tel" maxLength={40} />
        <button type="submit" className="pub-btn pub-btn-dark" disabled={!changed || saving} aria-busy={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { token, aplicarSesion } = useCustomer();
  const toast = useToast();
  const expired = useSessionExpired();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errors, setErrors] = useState<{ actual?: string; nueva?: string; repetir?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    const errs: typeof errors = {};
    if (!actual) errs.actual = 'Escriba su contraseña actual.';
    if (!meetsPolicy(nueva)) errs.nueva = 'La nueva contraseña todavía no cumple los requisitos.';
    if (nueva && repetir !== nueva) errs.repetir = 'Las contraseñas no coinciden.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      aplicarSesion(await portal.cambiarClave(token, actual, nueva));
      setActual('');
      setNueva('');
      setRepetir('');
      toast('Contraseña actualizada. Se cerraron sus sesiones en otros equipos.', 'ok');
    } catch (err) {
      if (expired(err)) return;
      if (err instanceof ApiError && err.errors.length) {
        const f = err.errors[0];
        if (f.field === 'currentPassword') setErrors({ actual: f.message });
        else setErrors({ nueva: err.errors.map((x) => x.message).join(' · ') });
      } else toast(errorMessage(err), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pub-panel" aria-labelledby="pf-clave">
      <h3 id="pf-clave">Cambiar contraseña</h3>
      <form onSubmit={submit} noValidate>
        <PasswordField id="pf-actual" label="Contraseña actual" value={actual} onChange={setActual} error={errors.actual} />
        <PasswordField id="pf-nueva" label="Nueva contraseña" value={nueva} onChange={setNueva} error={errors.nueva} autoComplete="new-password" />
        <PasswordStrength password={nueva} username="" />
        <PasswordField id="pf-repetir" label="Repita la nueva contraseña" value={repetir} onChange={setRepetir} error={errors.repetir} autoComplete="new-password" />
        <button type="submit" className="pub-btn pub-btn-dark" disabled={saving} aria-busy={saving}>
          {saving ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </section>
  );
}
