/* Administración › Cuentas del portal (mejora n.° 70): las cuentas con las que los clientes entran
   al portal. El portal le dice al cliente «escríbanos y le ayudamos a recuperar el acceso» y, si su
   RUC ya existe, «comuníquese para vincular su cuenta»: aquí se hace ambas cosas. Se crea la cuenta
   para un cliente que ya existe, se cambia el correo de acceso, se pone una contraseña temporal, se
   cierran sus sesiones y se activa o desactiva. Los datos del cliente se siguen editando en SIVEN. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { errorMessage } from '../../services/api/client';
import { fmtDateTime } from '../../utils/format';
import { passwordRules } from '../../utils/passwordPolicy';
import { adminApi, generarContrasena, type CuentaPortal, type Evento, type SocioAdmin } from './adminApi';
import { AdminHead, ClaveTemporal, Confirmar, ListaEventos, Vacio } from './ui';

type Listo = (msg: string) => void;
const correoOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
const telOk = (v: string) => !v.trim() || /^[0-9+()\-\s.]{6,40}$/.test(v.trim());
const camposDe = (e: unknown) =>
  Object.fromEntries(((e as { errors?: Array<{ field?: string; message: string }> }).errors ?? []).filter((x) => x.field).map((x) => [x.field!, x.message]));

export function PortalAccountsPage() {
  const modal = useModal();
  const toast = useToast();
  const [lista, setLista] = useState<CuentaPortal[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');

  const cargar = useCallback(() => {
    adminApi
      .cuentas()
      .then((c) => {
        setLista(c);
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(cargar, [cargar]);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (lista ?? [])
      .filter((c) => !s || `${c.email} ${c.contactName} ${c.phone ?? ''} ${c.customer.name} ${c.customer.ruc ?? ''}`.toLowerCase().includes(s))
      .filter((c) => !estado || (estado === 'nunca' ? !c.lastLoginAt : (estado === 'activas') === c.isActive))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.customer.name.localeCompare(b.customer.name));
  }, [lista, q, estado]);

  const activas = (lista ?? []).filter((c) => c.isActive).length;
  const nunca = (lista ?? []).filter((c) => !c.lastLoginAt).length;
  const listo: Listo = (msg) => {
    toast(msg, 'ok');
    cargar();
  };

  const abrir = {
    ficha: (c: CuentaPortal) => modal.open(<CuentaFicha cuenta={c} abrir={abrir} />),
    editar: (c: CuentaPortal) => modal.open(<CuentaForm cuenta={c} onListo={listo} />),
    clave: (c: CuentaPortal) => modal.open(<ResetCuenta cuenta={c} onListo={listo} />),
    sesiones: (c: CuentaPortal) =>
      modal.open(
        <Confirmar
          titulo="Cerrar las sesiones del cliente"
          boton="Cerrar sesiones"
          peligro
          onConfirmar={async () => {
            await adminApi.cerrarSesionesCuenta(c.id);
            listo(`Se cerraron las sesiones de ${c.email}`);
          }}
        >
          <p>
            Se cierran las sesiones abiertas de <b>{c.email}</b> ({c.customer.name}) en el portal. Su contraseña no cambia.
          </p>
        </Confirmar>,
      ),
    estado: (c: CuentaPortal) =>
      modal.open(
        <Confirmar
          titulo={c.isActive ? 'Desactivar la cuenta del portal' : 'Activar la cuenta del portal'}
          boton={c.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
          peligro={c.isActive}
          onConfirmar={async () => {
            await adminApi.estadoCuenta(c.id, !c.isActive);
            listo(`Cuenta ${c.email} ${c.isActive ? 'desactivada' : 'activada'}`);
          }}
        >
          <p>
            <b>{c.email}</b> · {c.customer.name}
          </p>
          <p>
            {c.isActive
              ? 'El cliente ya no podrá entrar al portal y su sesión abierta se cierra en su próxima acción. Sus solicitudes y cotizaciones se conservan, y NORCOR lo sigue atendiendo en SIVEN.'
              : 'El cliente podrá volver a entrar al portal con su contraseña actual.'}
          </p>
        </Confirmar>,
      ),
  };

  return (
    <>
      <AdminHead
        titulo="Cuentas del portal"
        desc="Las cuentas con las que los clientes entran al portal. Recupere su acceso, cambie su correo o cree la cuenta para un cliente que ya existe."
        acciones={
          <button type="button" className="b b-amber" onClick={() => modal.open(<CuentaForm onListo={listo} />)}>
            + Nueva cuenta
          </button>
        }
      />
      <div className="adm-stats">
        <div>
          <b>{lista?.length ?? '—'}</b>
          <span>cuentas</span>
        </div>
        <div>
          <b>{lista ? activas : '—'}</b>
          <span>activas</span>
        </div>
        <div>
          <b>{lista ? lista.length - activas : '—'}</b>
          <span>inactivas</span>
        </div>
        <div>
          <b>{lista ? nunca : '—'}</b>
          <span>nunca han entrado</span>
        </div>
      </div>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Buscar cuentas</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por correo, contacto, cliente o RUC…" />
        </label>
        <select className="toolbar-select" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todas las cuentas</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
          <option value="nunca">Nunca han entrado</option>
        </select>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Correo de acceso</th>
              <th>Contacto</th>
              <th className="num">Solicitudes</th>
              <th>Último ingreso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!lista && !error && <Vacio cols={7} msg="Cargando cuentas…" />}
            {lista && !lista.length && <Vacio cols={7} msg="Ningún cliente ha creado su cuenta todavía" />}
            {lista && !!lista.length && !filtrados.length && <Vacio cols={7} msg="Ninguna cuenta coincide con la búsqueda" />}
            {filtrados.map((c) => (
              <tr key={c.id} className={c.isActive ? '' : 'adm-off'}>
                <td>
                  <b>{c.customer.name}</b>
                  <div className="sub-num mono">
                    {c.customer.ruc || 'Sin RUC'}
                    {!c.customer.isActive && ' · cliente inactivo'}
                  </div>
                </td>
                <td>
                  <button type="button" className="adm-link" onClick={() => abrir.ficha(c)} title="Ver la ficha de la cuenta">
                    {c.email}
                  </button>
                </td>
                <td>
                  {c.contactName}
                  {c.phone && <div className="sub-num">{c.phone}</div>}
                </td>
                <td className="num mono">{c._count.inquiries}</td>
                <td className="mono">{c.lastLoginAt ? fmtDateTime(c.lastLoginAt) : <span className="muted-sm">Nunca</span>}</td>
                <td>{c.isActive ? <Tag tone="t-green">Activa</Tag> : <Tag>Inactiva</Tag>}</td>
                <td>
                  <span className="row-actions">
                    <button type="button" className="b b-out b-sm" onClick={() => abrir.editar(c)}>
                      Editar
                    </button>
                    <button type="button" className="b b-out b-sm" onClick={() => abrir.clave(c)}>
                      Contraseña
                    </button>
                    <button type="button" className={`b b-sm ${c.isActive ? 'b-red' : 'b-green'}`} onClick={() => abrir.estado(c)}>
                      {c.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type Abrir = Record<'ficha' | 'editar' | 'clave' | 'sesiones' | 'estado', (c: CuentaPortal) => void>;

/* ---------- Ficha de la cuenta ---------- */

function CuentaFicha({ cuenta: c, abrir }: { cuenta: CuentaPortal; abrir: Abrir }) {
  const { close } = useModal();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    adminApi
      .actividad({ entity: 'CustomerAccount', entityId: c.id, limit: 15 })
      .then((r) => vivo && setEventos(r.items))
      .catch((e) => vivo && setError(errorMessage(e)));
    return () => {
      vivo = false;
    };
  }, [c.id]);

  return (
    <Modal
      wide
      className="adm-ficha"
      title={c.customer.name}
      footer={
        <>
          <button type="button" className="b b-out adm-cerrar" onClick={close}>
            Cerrar
          </button>
          <button type="button" className="b b-out" onClick={() => abrir.editar(c)}>
            Editar
          </button>
          <button type="button" className="b b-out" onClick={() => abrir.clave(c)}>
            Contraseña
          </button>
          <button type="button" className="b b-out" onClick={() => abrir.sesiones(c)}>
            Cerrar sesiones
          </button>
          <button type="button" className={`b ${c.isActive ? 'b-red' : 'b-green'}`} onClick={() => abrir.estado(c)}>
            {c.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </>
      }
    >
      <dl className="adm-dl">
        <div>
          <dt>Correo de acceso</dt>
          <dd>{c.email}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>
            {c.customer.name}
            <span className="muted-sm mono"> · {c.customer.ruc || 'Sin RUC'}</span>
          </dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>
            {c.contactName}
            {c.phone && <span className="muted-sm"> · {c.phone}</span>}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{c.isActive ? <Tag tone="t-green">Activa</Tag> : <Tag>Inactiva</Tag>}</dd>
        </div>
        <div>
          <dt>Creada</dt>
          <dd className="mono">{fmtDateTime(c.createdAt)}</dd>
        </div>
        <div>
          <dt>Último ingreso</dt>
          <dd className="mono">{c.lastLoginAt ? fmtDateTime(c.lastLoginAt) : 'Nunca'}</dd>
        </div>
      </dl>
      <h3 className="adm-sub">Historial de la cuenta</h3>
      {error ? <div className="adm-error">{error}</div> : <ListaEventos eventos={eventos} conQuien vacio="Todavía no hay movimientos en esta cuenta." />}
    </Modal>
  );
}

/* ---------- Crear o editar ---------- */

function CuentaForm({ cuenta, onListo }: { cuenta?: CuentaPortal; onListo: Listo }) {
  const { close } = useModal();
  const toast = useToast();
  const nueva = !cuenta;
  const [d, setD] = useState({ email: cuenta?.email ?? '', contactName: cuenta?.contactName ?? '', phone: cuenta?.phone ?? '', password: nueva ? generarContrasena() : '' });
  const [cliente, setCliente] = useState<SocioAdmin | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof d) => (v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrores((x) => ({ ...x, [k]: '' }));
  };
  const reglas = passwordRules(d.password);
  const valido = correoOk(d.email) && d.contactName.trim() && telOk(d.phone) && (!nueva || (cliente && reglas.every((r) => r.ok)));
  const cambiaCorreo = !nueva && d.email.trim().toLowerCase() !== cuenta.email;

  const elegir = (c: SocioAdmin | null) => {
    setCliente(c);
    setErrores((x) => ({ ...x, customerId: '' }));
    // Propone el contacto y el correo de la ficha del cliente, si no se han escrito.
    if (c) setD((x) => ({ ...x, email: x.email || c.email || '', contactName: x.contactName || c.contactName || '', phone: x.phone || c.phone || '' }));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const datos = { email: d.email.trim(), contactName: d.contactName.trim(), phone: d.phone.trim() || null };
      if (nueva) {
        await adminApi.crearCuenta({ ...datos, customerId: cliente!.id, password: d.password });
        close();
        onListo(`Cuenta creada para ${cliente!.name}. Entréguele su correo y su contraseña temporal.`);
      } else {
        await adminApi.editarCuenta(cuenta.id, datos);
        close();
        onListo(cambiaCorreo ? `Ahora el cliente entra con ${datos.email.toLowerCase()}` : 'Cuenta actualizada');
      }
    } catch (e) {
      setErrores(camposDe(e));
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={nueva ? 'Nueva cuenta del portal' : `Editar la cuenta de ${cuenta.customer.name}`}
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="b b-amber" onClick={guardar} disabled={!valido || saving}>
            {saving ? 'Guardando…' : nueva ? 'Crear cuenta' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {nueva && <ElegirCliente valor={cliente} onElegir={elegir} error={errores.customerId} />}
      <div className="form-grid">
        <Field label="Correo de acceso" htmlFor="c-correo" full help={errores.email || 'Con este correo inicia sesión en el portal.'}>
          <input id="c-correo" type="email" className={errores.email ? 'is-invalid' : ''} value={d.email} onChange={(e) => set('email')(e.target.value)} maxLength={150} />
        </Field>
        <Field label="Persona de contacto" htmlFor="c-contacto" help={errores.contactName}>
          <input id="c-contacto" value={d.contactName} onChange={(e) => set('contactName')(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Teléfono" htmlFor="c-tel" help={errores.phone || (telOk(d.phone) ? 'Opcional.' : 'Solo números, espacios, +, guiones o paréntesis.')}>
          <input id="c-tel" className={errores.phone || !telOk(d.phone) ? 'is-invalid' : ''} value={d.phone} onChange={(e) => set('phone')(e.target.value)} maxLength={40} placeholder="+505 8888-8888" />
        </Field>
      </div>
      {cambiaCorreo && (
        <div className="note">
          <span className="ic">ℹ️</span>
          <div>
            Desde que guarde, el cliente entra al portal con <b>{d.email.trim().toLowerCase()}</b>. Si la ficha del cliente tenía el mismo correo, también se actualiza.
          </div>
        </div>
      )}
      {nueva && <ClaveTemporal valor={d.password} onCambio={set('password')} reglas={reglas} />}
    </Modal>
  );
}

/** Buscador de clientes activos para vincular la cuenta nueva. */
function ElegirCliente({ valor, onElegir, error }: { valor: SocioAdmin | null; onElegir: (c: SocioAdmin | null) => void; error?: string }) {
  const [clientes, setClientes] = useState<SocioAdmin[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    adminApi
      .socios('customers')
      .then((l) => setClientes(l.filter((c) => c.isActive).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setClientes([]));
  }, []);
  const s = q.trim().toLowerCase();
  const opciones = (clientes ?? []).filter((c) => !s || `${c.name} ${c.ruc ?? ''} ${c.contactName ?? ''}`.toLowerCase().includes(s)).slice(0, 8);

  if (valor)
    return (
      <div className="adm-pick is-set">
        <div>
          <b>{valor.name}</b>
          <div className="sub-num mono">{valor.ruc || 'Sin RUC'}</div>
        </div>
        <button type="button" className="b b-out b-sm" onClick={() => onElegir(null)}>
          Cambiar
        </button>
      </div>
    );
  return (
    <Field label="Cliente" htmlFor="c-cliente" full help={error || 'El cliente que ya existe en SIVEN. La cuenta verá sus solicitudes y cotizaciones.'}>
      <input id="c-cliente" type="search" className={error ? 'is-invalid' : ''} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, RUC o contacto…" autoFocus />
      <ul className="adm-pick-list" role="listbox" aria-label="Clientes">
        {!clientes && <li className="muted-sm">Cargando clientes…</li>}
        {clientes && !opciones.length && <li className="muted-sm">Ningún cliente activo coincide.</li>}
        {opciones.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onElegir(c)}>
              <b>{c.name}</b>
              <span className="mono">{c.ruc || 'Sin RUC'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Field>
  );
}

/* ---------- Contraseña temporal ---------- */

function ResetCuenta({ cuenta: c, onListo }: { cuenta: CuentaPortal; onListo: Listo }) {
  const { close } = useModal();
  const toast = useToast();
  const [clave, setClave] = useState(generarContrasena);
  const [saving, setSaving] = useState(false);
  const reglas = passwordRules(clave);

  const guardar = async () => {
    setSaving(true);
    try {
      await adminApi.restablecerCuenta(c.id, clave);
      close();
      onListo(`Contraseña de ${c.email} restablecida`);
    } catch (e) {
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Restablecer la contraseña del portal"
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="b b-amber" onClick={guardar} disabled={!reglas.every((r) => r.ok) || saving}>
            {saving ? 'Guardando…' : 'Restablecer contraseña'}
          </button>
        </>
      }
    >
      <p className="muted-sm" style={{ marginBottom: 12 }}>
        {c.customer.name} · {c.email}
      </p>
      <ClaveTemporal valor={clave} onCambio={setClave} reglas={reglas} />
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>Se cierran las sesiones que el cliente tenga abiertas. Entréguele la contraseña por un medio privado (WhatsApp o llamada); después puede cambiarla en «Mi perfil».</div>
      </div>
    </Modal>
  );
}
