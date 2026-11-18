/* Administración › Usuarios (mejoras n.° 66 y 69): crear usuarios con su rol y tener el control
   completo de cada cuenta: usuario, correo, nombres y rol, contraseña, sesiones abiertas y estado.
   La ficha de cada usuario muestra lo que ha hecho y los cambios que se le han hecho a su cuenta.
   El backend impide cambiar el propio rol, desactivar la propia cuenta y repetir usuario o correo. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { ROLES } from '../../config/navigation';
import { REMEMBER_USER_KEY } from '../../config/security';
import { errorMessage } from '../../services/api/client';
import { ROLE_FROM_API, type ApiRole } from '../../services/api/mappers';
import { useAuth } from '../../store/hooks';
import { fmtDateTime } from '../../utils/format';
import { passwordRules } from '../../utils/passwordPolicy';
import { adminApi, generarContrasena, type Evento, type FiltroActividad, type UsuarioAdmin } from './adminApi';
import { AdminHead, ClaveTemporal, Confirmar, ListaEventos, Vacio } from './ui';

const ORDEN_ROLES: ApiRole[] = ['ADMIN', 'MANAGEMENT', 'SELLER', 'INVENTORY_MANAGER', 'ACCOUNTING', 'TECHNICIAN'];
const nombreRol = (r: ApiRole) => ROLES[ROLE_FROM_API[r]].name;
const USUARIO_RE = /^[a-z0-9._-]{3,50}$/;

type Listo = (msg: string) => void;

function RolTag({ code }: { code: ApiRole }) {
  return (
    <span className="adm-role" style={{ ['--rc' as string]: ROLES[ROLE_FROM_API[code]].color }}>
      {nombreRol(code)}
    </span>
  );
}

export function UsersPage() {
  const { user } = useAuth();
  const modal = useModal();
  const toast = useToast();
  const [lista, setLista] = useState<UsuarioAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState('');

  const cargar = useCallback(() => {
    adminApi
      .usuarios()
      .then((u) => {
        setLista(u);
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(cargar, [cargar]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista ?? [])
      .filter((u) => !t || `${u.username} ${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(t))
      .filter((u) => !rol || u.role.code === rol)
      .filter((u) => !estado || (estado === 'activos') === u.isActive)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || ORDEN_ROLES.indexOf(a.role.code) - ORDEN_ROLES.indexOf(b.role.code) || a.username.localeCompare(b.username));
  }, [lista, q, rol, estado]);

  const activos = (lista ?? []).filter((u) => u.isActive).length;
  const nunca = (lista ?? []).filter((u) => !u.lastLoginAt).length;
  const listo: Listo = (msg) => {
    toast(msg, 'ok');
    cargar();
  };
  const acciones = useAcciones(user?.id, listo);

  return (
    <>
      <AdminHead
        titulo="Usuarios"
        desc="Las personas que entran a SIVEN. Haga clic en un usuario para ver su ficha y su actividad."
        acciones={
          <button type="button" className="b b-amber" onClick={() => modal.open(<UserForm onListo={listo} />)}>
            + Nuevo usuario
          </button>
        }
      />
      <div className="adm-stats">
        <div>
          <b>{lista?.length ?? '—'}</b>
          <span>usuarios</span>
        </div>
        <div>
          <b>{lista ? activos : '—'}</b>
          <span>activos</span>
        </div>
        <div>
          <b>{lista ? lista.length - activos : '—'}</b>
          <span>inactivos</span>
        </div>
        <div>
          <b>{lista ? nunca : '—'}</b>
          <span>nunca han entrado</span>
        </div>
      </div>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Buscar usuarios</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por usuario, nombre o correo…" />
        </label>
        <select className="toolbar-select" value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol">
          <option value="">Todos los roles</option>
          {ORDEN_ROLES.map((r) => (
            <option key={r} value={r}>
              {nombreRol(r)}
            </option>
          ))}
        </select>
        <select className="toolbar-select" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Activos e inactivos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Último ingreso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!lista && !error && <Vacio cols={7} msg="Cargando usuarios…" />}
            {lista && !filtrados.length && <Vacio cols={7} msg="Ningún usuario coincide con la búsqueda" />}
            {filtrados.map((u) => {
              const yo = u.id === user?.id;
              return (
                <tr key={u.id} className={u.isActive ? '' : 'adm-off'}>
                  <td className="mono">
                    <button type="button" className="adm-link mono" onClick={() => modal.open(<UserFicha usuario={u} esYo={yo} acciones={acciones} />)} title="Ver la ficha del usuario">
                      {u.username}
                    </button>
                    {yo && <div className="sub-num">usted</div>}
                  </td>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <RolTag code={u.role.code} />
                  </td>
                  <td className="mono">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="muted-sm">Nunca</span>}</td>
                  <td>{u.isActive ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>}</td>
                  <td>
                    <span className="row-actions">
                      <button type="button" className="b b-out b-sm" onClick={() => acciones.editar(u)}>
                        Editar
                      </button>
                      <button type="button" className="b b-out b-sm" onClick={() => acciones.clave(u)}>
                        Contraseña
                      </button>
                      <button
                        type="button"
                        className={`b b-sm ${u.isActive ? 'b-red' : 'b-green'}`}
                        disabled={yo}
                        title={yo ? 'No puede desactivar su propia cuenta' : undefined}
                        onClick={() => acciones.estado(u)}
                      >
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Acciones (desde la tabla o desde la ficha) ---------- */

function useAcciones(miId: string | undefined, listo: Listo) {
  const modal = useModal();
  return useMemo(
    () => ({
      editar: (u: UsuarioAdmin) => modal.open(<UserForm usuario={u} esYo={u.id === miId} onListo={listo} />),
      clave: (u: UsuarioAdmin) => modal.open(<ResetForm usuario={u} onListo={listo} />),
      sesiones: (u: UsuarioAdmin) =>
        modal.open(
          <Confirmar
            titulo={`Cerrar las sesiones de ${u.username}`}
            boton="Cerrar sesiones"
            peligro
            onConfirmar={async () => {
              await adminApi.cerrarSesiones(u.id);
              listo(`Se cerraron las sesiones de ${u.username}`);
            }}
          >
            <p>
              Se cierran todas las sesiones que{' '}
              <b>
                {u.firstName} {u.lastName}
              </b>{' '}
              tenga abiertas, en cualquier computadora o celular. Su contraseña no cambia: puede volver a entrar cuando quiera.
            </p>
            <p className="muted-sm">Úselo si perdió su celular o dejó la sesión abierta en un equipo compartido.</p>
          </Confirmar>,
        ),
      estado: (u: UsuarioAdmin) =>
        modal.open(
          <Confirmar
            titulo={u.isActive ? `Desactivar a ${u.username}` : `Activar a ${u.username}`}
            boton={u.isActive ? 'Desactivar usuario' : 'Activar usuario'}
            peligro={u.isActive}
            onConfirmar={async () => {
              await adminApi.estadoUsuario(u.id, !u.isActive);
              listo(`${u.username} ${u.isActive ? 'desactivado' : 'activado'}`);
            }}
          >
            {u.isActive ? (
              <p>
                <b>
                  {u.firstName} {u.lastName}
                </b>{' '}
                ya no podrá iniciar sesión y, si tiene una sesión abierta, se cerrará en su próxima acción. Su historial (ventas, movimientos, auditoría) se conserva.
              </p>
            ) : (
              <p>
                <b>
                  {u.firstName} {u.lastName}
                </b>{' '}
                podrá volver a iniciar sesión con su contraseña actual.
              </p>
            )}
          </Confirmar>,
        ),
    }),
    [modal, miId, listo],
  );
}

type Acciones = ReturnType<typeof useAcciones>;

/* ---------- Ficha del usuario ---------- */

function UserFicha({ usuario: u, esYo, acciones }: { usuario: UsuarioAdmin; esYo: boolean; acciones: Acciones }) {
  const { close } = useModal();
  const [tab, setTab] = useState<'hizo' | 'cuenta'>('hizo');

  return (
    <Modal
      wide
      className="adm-ficha"
      title={`${u.firstName} ${u.lastName}`}
      footer={
        <>
          <button type="button" className="b b-out adm-cerrar" onClick={close}>
            Cerrar
          </button>
          <button type="button" className="b b-out" onClick={() => acciones.editar(u)}>
            Editar
          </button>
          <button type="button" className="b b-out" onClick={() => acciones.clave(u)}>
            Contraseña
          </button>
          <button type="button" className="b b-out" disabled={esYo} title={esYo ? 'Para cerrar su propia sesión use «Cerrar sesión»' : undefined} onClick={() => acciones.sesiones(u)}>
            Cerrar sesiones
          </button>
          <button type="button" className={`b ${u.isActive ? 'b-red' : 'b-green'}`} disabled={esYo} onClick={() => acciones.estado(u)}>
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </>
      }
    >
      <dl className="adm-dl">
        <div>
          <dt>Usuario</dt>
          <dd className="mono">
            {u.username}
            {esYo && <span className="muted-sm"> (usted)</span>}
          </dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{u.email}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>
            <RolTag code={u.role.code} />
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{u.isActive ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>}</dd>
        </div>
        <div>
          <dt>Creado</dt>
          <dd className="mono">{fmtDateTime(u.createdAt)}</dd>
        </div>
        <div>
          <dt>Último ingreso</dt>
          <dd className="mono">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Nunca'}</dd>
        </div>
      </dl>
      <div className="adm-seg" role="tablist" aria-label="Historial">
        <button type="button" role="tab" aria-selected={tab === 'hizo'} className={tab === 'hizo' ? 'is-on' : ''} onClick={() => setTab('hizo')}>
          Lo que ha hecho
        </button>
        <button type="button" role="tab" aria-selected={tab === 'cuenta'} className={tab === 'cuenta' ? 'is-on' : ''} onClick={() => setTab('cuenta')}>
          Cambios a su cuenta
        </button>
      </div>
      <Historial
        key={tab}
        filtro={tab === 'hizo' ? { userId: u.id, limit: 15 } : { entity: 'User', entityId: u.id, limit: 15 }}
        conQuien={tab === 'cuenta'}
        vacio={tab === 'hizo' ? 'Todavía no hay actividad de este usuario.' : 'Nadie ha modificado esta cuenta desde que se creó.'}
      />
      <p className="muted-sm" style={{ marginTop: 8 }}>
        Se muestran los 15 registros más recientes. El historial completo está en Actividad y en la Auditoría de SIVEN.
      </p>
    </Modal>
  );
}

/** Últimos registros de la bitácora con un filtro fijo (se vuelve a montar al cambiar de pestaña). */
function Historial({ filtro, vacio, conQuien }: { filtro: FiltroActividad; vacio: string; conQuien: boolean }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState('');
  const clave = JSON.stringify(filtro);
  useEffect(() => {
    let vivo = true;
    adminApi
      .actividad(JSON.parse(clave) as FiltroActividad)
      .then((r) => vivo && setEventos(r.items))
      .catch((e) => vivo && setError(errorMessage(e)));
    return () => {
      vivo = false;
    };
  }, [clave]);
  return error ? <div className="adm-error">{error}</div> : <ListaEventos eventos={eventos} conQuien={conQuien} vacio={vacio} />;
}

/* ---------- Crear o editar ---------- */

function UserForm({ usuario, esYo = false, onListo }: { usuario?: UsuarioAdmin; esYo?: boolean; onListo: Listo }) {
  const { close } = useModal();
  const toast = useToast();
  const nuevo = !usuario;
  const [d, setD] = useState({
    username: usuario?.username ?? '',
    firstName: usuario?.firstName ?? '',
    lastName: usuario?.lastName ?? '',
    email: usuario?.email ?? '',
    role: usuario?.role.code ?? ('SELLER' as ApiRole),
    password: nuevo ? generarContrasena() : '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof d) => (v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrores((x) => ({ ...x, [k]: '' }));
  };
  const reglas = passwordRules(d.password, d.username);
  const usuarioOk = USUARIO_RE.test(d.username);
  const correoOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim());
  const valido = d.firstName.trim() && d.lastName.trim() && correoOk && usuarioOk && (!nuevo || reglas.every((r) => r.ok));
  const cambiaUsuario = !nuevo && d.username !== usuario.username;
  const cambiaCorreo = !nuevo && d.email.trim().toLowerCase() !== usuario.email;

  const guardar = async () => {
    setSaving(true);
    try {
      const base = { username: d.username, firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), role: d.role };
      if (nuevo) {
        await adminApi.crearUsuario({ ...base, password: d.password });
        close();
        onListo(`Usuario ${d.username} creado. Entréguele su contraseña temporal.`);
        return;
      }
      const { role, ...sinRol } = base;
      await adminApi.editarUsuario(usuario.id, esYo ? sinRol : { ...sinRol, role });
      close();
      if (esYo) {
        // «Recordar mi usuario» guarda el usuario anterior: se actualiza para el próximo inicio de sesión.
        try {
          if (cambiaUsuario && localStorage.getItem(REMEMBER_USER_KEY) === usuario.username) localStorage.setItem(REMEMBER_USER_KEY, d.username);
        } catch {
          /* sin almacenamiento local */
        }
        toast('Su cuenta se actualizó', 'ok');
        // La sesión se restaura con los datos nuevos (GET /auth/me).
        setTimeout(() => window.location.reload(), 700);
        return;
      }
      onListo(cambiaUsuario ? `Usuario actualizado: ahora entra como ${d.username}` : `Usuario ${usuario.username} actualizado`);
    } catch (e) {
      const errs = (e as { errors?: Array<{ field?: string; message: string }> }).errors ?? [];
      setErrores(Object.fromEntries(errs.filter((x) => x.field).map((x) => [x.field!, x.message])));
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={nuevo ? 'Nuevo usuario' : `Editar ${usuario.username}`}
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="b b-amber" onClick={guardar} disabled={!valido || saving}>
            {saving ? 'Guardando…' : nuevo ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nombres" htmlFor="u-nombres">
          <input id="u-nombres" value={d.firstName} onChange={(e) => set('firstName')(e.target.value)} maxLength={100} autoFocus />
        </Field>
        <Field label="Apellidos" htmlFor="u-apellidos">
          <input id="u-apellidos" value={d.lastName} onChange={(e) => set('lastName')(e.target.value)} maxLength={100} />
        </Field>
        <Field
          label="Usuario"
          htmlFor="u-usuario"
          help={
            errores.username ||
            (d.username && !usuarioOk ? 'De 3 a 50: minúsculas, números, punto, guion o guion bajo.' : 'Con él inicia sesión. Minúsculas, números, punto o guion.')
          }
        >
          <input
            id="u-usuario"
            className={errores.username || (d.username && !usuarioOk) ? 'is-invalid' : ''}
            value={d.username}
            onChange={(e) => set('username')(e.target.value.toLowerCase().replace(/\s/g, ''))}
            maxLength={50}
            placeholder="jperez"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Correo" htmlFor="u-correo" help={errores.email || 'A este correo le llega el código si olvida su contraseña.'}>
          <input id="u-correo" type="email" className={errores.email ? 'is-invalid' : ''} value={d.email} onChange={(e) => set('email')(e.target.value)} maxLength={150} />
        </Field>
        <Field label="Rol" htmlFor="u-rol" full help={esYo ? 'No puede cambiar su propio rol.' : 'Decide qué módulos verá en SIVEN (vea Roles y permisos).'}>
          <select id="u-rol" value={d.role} disabled={esYo} onChange={(e) => set('role')(e.target.value)}>
            {ORDEN_ROLES.map((r) => (
              <option key={r} value={r}>
                {nombreRol(r)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {(cambiaUsuario || cambiaCorreo) && (
        <div className="note" style={{ marginTop: 4 }}>
          <span className="ic">ℹ️</span>
          <div>
            {cambiaUsuario && (
              <p style={{ margin: 0 }}>
                Desde que guarde, {esYo ? 'usted entra' : 'la persona entra'} con <b className="mono">{d.username}</b> (o con su correo). Su historial y su auditoría se conservan.
              </p>
            )}
            {cambiaCorreo && (
              <p style={{ margin: cambiaUsuario ? '4px 0 0' : 0 }}>
                El código para recuperar la contraseña llegará a <b>{d.email.trim().toLowerCase()}</b>.
              </p>
            )}
            {esYo && <p style={{ margin: '4px 0 0' }}>Su sesión sigue abierta; la página se recargará con sus datos nuevos.</p>}
          </div>
        </div>
      )}
      {nuevo && <ClaveTemporal valor={d.password} onCambio={set('password')} reglas={reglas} />}
    </Modal>
  );
}

/* ---------- Restablecer contraseña ---------- */

function ResetForm({ usuario, onListo }: { usuario: UsuarioAdmin; onListo: Listo }) {
  const { close } = useModal();
  const toast = useToast();
  const [clave, setClave] = useState(generarContrasena);
  const [saving, setSaving] = useState(false);
  const reglas = passwordRules(clave, usuario.username);

  const guardar = async () => {
    setSaving(true);
    try {
      await adminApi.restablecer(usuario.id, clave);
      close();
      onListo(`Contraseña de ${usuario.username} restablecida`);
    } catch (e) {
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Restablecer la contraseña de ${usuario.username}`}
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
        {usuario.firstName} {usuario.lastName} · {usuario.email}
      </p>
      <ClaveTemporal valor={clave} onCambio={setClave} reglas={reglas} />
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>Se cerrarán las sesiones que tenga abiertas. Después, la persona puede poner una contraseña propia con «¿Olvidó su contraseña?» en el inicio de sesión.</div>
      </div>
    </Modal>
  );
}
