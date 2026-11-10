/* Administración › Usuarios: crear usuarios con su rol, editarlos, restablecer su contraseña y
   activarlos o desactivarlos. El backend impide cambiar el propio rol y desactivar la propia cuenta. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/common/Icon';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { ROLES } from '../../config/navigation';
import { errorMessage } from '../../services/api/client';
import { ROLE_FROM_API, type ApiRole } from '../../services/api/mappers';
import { useAuth } from '../../store/hooks';
import { fmtDateTime } from '../../utils/format';
import { passwordRules } from '../../utils/passwordPolicy';
import { adminApi, generarContrasena, type UsuarioAdmin } from './adminApi';
import { AdminHead, Confirmar, Vacio } from './ui';

const ORDEN_ROLES: ApiRole[] = ['ADMIN', 'MANAGEMENT', 'SELLER', 'INVENTORY_MANAGER', 'ACCOUNTING', 'TECHNICIAN'];
const nombreRol = (r: ApiRole) => ROLES[ROLE_FROM_API[r]].name;

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
  const listo = (msg: string) => {
    toast(msg, 'ok');
    cargar();
  };

  const cambiarEstado = (u: UsuarioAdmin) =>
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
    );

  return (
    <>
      <AdminHead
        titulo="Usuarios"
        desc="Las personas que entran a SIVEN. El rol decide qué módulos ve cada una."
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
                    {u.username}
                    {yo && <div className="sub-num">usted</div>}
                  </td>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="adm-role" style={{ ['--rc' as string]: ROLES[ROLE_FROM_API[u.role.code]].color }}>
                      {nombreRol(u.role.code)}
                    </span>
                  </td>
                  <td className="mono">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="muted-sm">Nunca</span>}</td>
                  <td>{u.isActive ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>}</td>
                  <td>
                    <span className="row-actions">
                      <button type="button" className="b b-out b-sm" onClick={() => modal.open(<UserForm usuario={u} esYo={yo} onListo={listo} />)}>
                        Editar
                      </button>
                      <button type="button" className="b b-out b-sm" onClick={() => modal.open(<ResetForm usuario={u} onListo={listo} />)}>
                        Contraseña
                      </button>
                      <button
                        type="button"
                        className={`b b-sm ${u.isActive ? 'b-red' : 'b-green'}`}
                        disabled={yo}
                        title={yo ? 'No puede desactivar su propia cuenta' : undefined}
                        onClick={() => cambiarEstado(u)}
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

/* ---------- Crear o editar ---------- */

function UserForm({ usuario, esYo = false, onListo }: { usuario?: UsuarioAdmin; esYo?: boolean; onListo: (msg: string) => void }) {
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
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const reglas = passwordRules(d.password, d.username);
  const usuarioOk = /^[a-z0-9._-]{3,50}$/.test(d.username);
  const valido = d.firstName.trim() && d.lastName.trim() && /\S+@\S+\.\S+/.test(d.email) && (!nuevo || (usuarioOk && reglas.every((r) => r.ok)));

  const guardar = async () => {
    setSaving(true);
    try {
      const base = { firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), role: d.role };
      if (nuevo) {
        await adminApi.crearUsuario({ ...base, username: d.username, password: d.password });
        close();
        onListo(`Usuario ${d.username} creado. Entréguele su contraseña temporal.`);
      } else {
        await adminApi.editarUsuario(usuario.id, esYo ? { firstName: base.firstName, lastName: base.lastName, email: base.email } : base);
        close();
        onListo(`Usuario ${usuario.username} actualizado`);
      }
    } catch (e) {
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
        <Field label="Usuario" htmlFor="u-usuario" help={nuevo ? 'Para iniciar sesión. Minúsculas, números, punto o guion. No se puede cambiar después.' : 'El usuario no se puede cambiar.'}>
          <input id="u-usuario" value={d.username} disabled={!nuevo} onChange={(e) => set('username')(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={50} placeholder="jperez" />
        </Field>
        <Field label="Correo" htmlFor="u-correo" help="A este correo le llega el código si olvida su contraseña.">
          <input id="u-correo" type="email" value={d.email} onChange={(e) => set('email')(e.target.value)} maxLength={150} />
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
      {nuevo && <ClaveTemporal valor={d.password} onCambio={set('password')} reglas={reglas} />}
    </Modal>
  );
}

/* ---------- Restablecer contraseña ---------- */

function ResetForm({ usuario, onListo }: { usuario: UsuarioAdmin; onListo: (msg: string) => void }) {
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

function ClaveTemporal({ valor, onCambio, reglas }: { valor: string; onCambio: (v: string) => void; reglas: ReturnType<typeof passwordRules> }) {
  const toast = useToast();
  const copiar = () =>
    navigator.clipboard
      ?.writeText(valor)
      .then(() => toast('Contraseña copiada', 'ok'))
      .catch(() => toast('No se pudo copiar; selecciónela y cópiela a mano', 'err'));
  return (
    <div className="adm-pass">
      <Field label="Contraseña temporal" htmlFor="u-clave" help="Entréguela a la persona en privado. Se genera sola; puede escribir otra.">
        <div className="adm-pass-row">
          <input id="u-clave" className="mono" value={valor} onChange={(e) => onCambio(e.target.value)} maxLength={72} autoComplete="new-password" spellCheck={false} />
          <button type="button" className="b b-out b-sm" onClick={() => onCambio(generarContrasena())} title="Generar otra">
            <Icon name="refresh-cw" size={14} /> Otra
          </button>
          <button type="button" className="b b-out b-sm" onClick={copiar}>
            Copiar
          </button>
        </div>
      </Field>
      <ul className="adm-rules">
        {reglas.map((r) => (
          <li key={r.id} className={r.ok ? 'ok' : ''}>
            {r.ok ? '✓' : '•'} {r.label.replace('su nombre de usuario', 'el nombre de usuario')}
          </li>
        ))}
      </ul>
    </div>
  );
}
