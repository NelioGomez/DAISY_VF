/* Contacto: datos de la empresa (system_config → /public/settings) y un formulario que queda como
   solicitud Nueva en el sistema interno. El cliente elige el motivo (mejora n.° 59): solo los
   pedidos de precios llegan como cotización; servicio técnico o garantía, datos de la cuenta,
   reclamos y otras consultas se atienden distinto. Con la sesión iniciada, el mensaje queda
   enlazado a su cuenta y no hace falta escribir nombre ni contacto. */
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ApiError, errorMessage } from '../../services/api/client';
import type { ApiInquiryType } from '../../services/api/mappers';
import * as portal from '../../services/portal/portalService';
import { enviarContacto, whatsappUrl } from '../../services/public/publicService';
import { useCustomer } from '../portal/useCustomer';
import { TextField } from './TextField';
import { usePublicInfo } from './usePublicInfo';

const CONTACT_RE = /^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}|\+?[0-9][0-9()\-\s.]{5,29})$/;

const MOTIVOS: Array<{ id: ApiInquiryType; label: string; desc: string; param: string }> = [
  { id: 'QUOTE', label: 'Precios o cotización', desc: 'Repuestos y equipos', param: 'cotizacion' },
  { id: 'SERVICE', label: 'Servicio técnico o garantía', desc: 'Reparación, instalación o falla', param: 'servicio' },
  { id: 'ACCOUNT', label: 'Mi cuenta', desc: 'Correo, contraseña o datos', param: 'cuenta' },
  { id: 'COMPLAINT', label: 'Reclamo o sugerencia', desc: 'Algo no salió bien', param: 'reclamo' },
  { id: 'OTHER', label: 'Otra consulta', desc: 'Pedidos, horarios, pagos…', param: 'otra' },
];

/** /contacto?motivo=cuenta (enlaces del portal) preselecciona el motivo. */
const fromParam = (v: string | null): ApiInquiryType | '' => MOTIVOS.find((m) => m.param === v || m.id === v)?.id ?? '';

type Errors = Partial<Record<'motivo' | 'nombre' | 'contacto' | 'mensaje', string>>;

export function ContactPage() {
  usePageTitle('Contacto');
  const { info } = usePublicInfo();
  const { cuenta, token } = useCustomer();
  const [params] = useSearchParams();
  const empresa = info?.empresa;

  const [form, setForm] = useState(() => ({
    motivo: fromParam(params.get('motivo')),
    nombre: cuenta?.cliente.nombre ?? '',
    contacto: cuenta?.email ?? '',
    producto: '',
    mensaje: '',
    website: '', // campo trampa para bots: queda oculto
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ code: string | null } | null>(null);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const conSesion = !!(cuenta && token);
  const motivo = form.motivo;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!motivo) errs.motivo = 'Elija el motivo de su mensaje.';
    if (!conSesion) {
      if (!form.nombre.trim()) errs.nombre = 'Escriba su nombre o el de su empresa.';
      if (!form.contacto.trim()) errs.contacto = 'Escriba un teléfono o un correo para responderle.';
      else if (!CONTACT_RE.test(form.contacto.trim())) errs.contacto = 'Escriba un correo válido o un teléfono (solo números, espacios o guiones).';
    }
    if (conSesion ? !form.mensaje.trim() : !form.mensaje.trim() && !form.producto.trim()) errs.mensaje = 'Cuéntenos qué necesita.';
    setErrors(errs);
    if (Object.keys(errs).length || !motivo) return;
    setSending(true);
    setError('');
    try {
      const code = conSesion
        ? (await portal.enviarMensaje(token!, { tipo: motivo, producto: form.producto, mensaje: form.mensaje })).codigo
        : await enviarContacto({ ...form, tipo: motivo });
      setSent({ code });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Ya recibimos varias solicitudes desde su conexión. Intente de nuevo en una hora o escríbanos por WhatsApp.' : errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const canales = [
    { label: 'WhatsApp', value: empresa?.whatsapp || 'Abrir chat de WhatsApp', href: whatsappUrl(empresa, 'Hola NORCOR, necesito información.'), external: true },
    empresa?.telefono && { label: 'Teléfono', value: empresa.telefono, href: `tel:${empresa.telefono.replace(/[^\d+]/g, '')}` },
    empresa?.correo && { label: 'Correo', value: empresa.correo, href: `mailto:${empresa.correo}` },
    empresa?.direccion && { label: 'Dirección', value: empresa.direccion },
    empresa?.horario && { label: 'Horario de atención', value: empresa.horario },
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string; external?: boolean }>;

  return (
    <div className="pub-page">
      <header className="pub-page-head">
        <h1>Contacto</h1>
        <p className="pub-lead">Consúltenos por un repuesto, un servicio técnico o una garantía, o por los datos de su cuenta.</p>
      </header>

      <div className="pub-contact">
        <section aria-labelledby="channels-title" className="pub-channels">
          <h2 id="channels-title" className="sr-only">
            Canales de atención
          </h2>
          <dl>
            {canales.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>
                  {c.href ? (
                    <a href={c.href} {...(c.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                      {c.value}
                    </a>
                  ) : (
                    c.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="pub-tip">
            <h3>¿Cotiza varios productos?</h3>
            <p>Agréguelos a su lista desde el catálogo y envíela con su cuenta de cliente: así recibe una cotización formal y puede seguirla en línea.</p>
            <Link to="/catalogo" className="pub-textlink">
              Ir al catálogo
            </Link>
          </div>
        </section>

        <section className="pub-formcard" aria-labelledby="form-title">
          {sent ? (
            <div className="pub-sent is-inline" aria-live="polite">
              {sent.code && <div className="pub-sent-code">{sent.code}</div>}
              <h2 id="form-title">Mensaje recibido</h2>
              <p>
                {conSesion ? 'Lo verá en Mis solicitudes y le responderemos por su correo o teléfono' : 'Le responderemos al contacto que nos dejó'}
                {sent.code ? '. Mencione este número si nos escribe por otro medio.' : '.'}
              </p>
              <button
                type="button"
                className="pub-btn pub-btn-line"
                onClick={() => {
                  setSent(null);
                  setForm((f) => ({ ...f, motivo: '', producto: '', mensaje: '' }));
                }}
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 id="form-title">Envíenos un mensaje</h2>

              <fieldset className={`pub-motivos ${errors.motivo ? 'has-error' : ''}`} aria-describedby={errors.motivo ? 'c-motivo-err' : undefined}>
                <legend>¿En qué le ayudamos?</legend>
                <div className="pub-motivos-grid">
                  {MOTIVOS.map((m) => (
                    <label key={m.id} className={`pub-motivo ${motivo === m.id ? 'is-on' : ''}`}>
                      <input type="radio" name="motivo" value={m.id} checked={motivo === m.id} onChange={() => set('motivo')(m.id)} />
                      <span>
                        <b>{m.label}</b>
                        <small>{m.desc}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.motivo && (
                  <span id="c-motivo-err" className="pub-field-err">
                    {errors.motivo}
                  </span>
                )}
              </fieldset>

              {motivo === 'ACCOUNT' && (
                <div className="pub-hint" role="note">
                  {conSesion ? (
                    <>
                      Su <b>correo de acceso</b> y su <b>contraseña</b> los puede cambiar usted mismo en{' '}
                      <Link to="/clientes/cuenta/perfil">Mi perfil</Link>. Escríbanos aquí para corregir el nombre, el RUC o la dirección de su empresa.
                    </>
                  ) : (
                    <>
                      ¿Olvidó su contraseña? Escríbanos aquí con el correo de su cuenta y le ayudamos a recuperar el acceso. Si la recuerda,{' '}
                      <Link to="/clientes/ingresar">inicie sesión</Link>: en Mi perfil puede cambiar usted mismo su correo y su contraseña.
                    </>
                  )}
                </div>
              )}
              {motivo === 'SERVICE' && (
                <div className="pub-hint" role="note">
                  Si es una garantía, indique el producto y el número de su factura (FAC-…) para revisar la cobertura.
                </div>
              )}

              {conSesion ? (
                <p className="pub-muted is-small">
                  Enviará el mensaje como <b>{cuenta!.cliente.nombre}</b> ({cuenta!.email}).
                </p>
              ) : (
                <>
                  <TextField id="c-nombre" label="Nombre o empresa" value={form.nombre} onChange={set('nombre')} error={errors.nombre} autoComplete="organization" maxLength={200} />
                  <TextField
                    id="c-contacto"
                    label="Teléfono o correo"
                    value={form.contacto}
                    onChange={set('contacto')}
                    error={errors.contacto}
                    autoComplete="email"
                    maxLength={150}
                    help="Lo usamos solo para responderle."
                  />
                </>
              )}
              {(motivo === '' || motivo === 'QUOTE' || motivo === 'SERVICE') && (
                <TextField
                  id="c-producto"
                  label={motivo === 'SERVICE' ? 'Equipo o producto (opcional)' : 'Producto de interés (opcional)'}
                  value={form.producto}
                  onChange={set('producto')}
                  maxLength={200}
                />
              )}
              <div className={`pub-field ${errors.mensaje ? 'has-error' : ''}`}>
                <label htmlFor="c-mensaje">Mensaje</label>
                <textarea
                  id="c-mensaje"
                  rows={5}
                  maxLength={1000}
                  value={form.mensaje}
                  onChange={(e) => set('mensaje')(e.target.value)}
                  aria-invalid={!!errors.mensaje}
                  aria-describedby={errors.mensaje ? 'c-mensaje-err' : undefined}
                />
                {errors.mensaje && (
                  <span id="c-mensaje-err" className="pub-field-err">
                    {errors.mensaje}
                  </span>
                )}
              </div>
              <div className="pub-hp" aria-hidden="true">
                <label htmlFor="c-website">Sitio web</label>
                <input id="c-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website')(e.target.value)} />
              </div>
              {error && (
                <p className="pub-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="pub-btn pub-btn-amber is-block" disabled={sending} aria-busy={sending}>
                {sending ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
