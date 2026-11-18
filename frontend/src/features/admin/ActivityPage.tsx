/* Administración › Actividad (mejora n.° 71): la bitácora vista desde la administración.
   - Accesos: inicios de sesión, intentos fallidos, usuarios inactivos que intentaron entrar,
     cierres de sesión y recuperaciones de contraseña, en SIVEN y en el portal de clientes.
   - Cambios: lo que se hizo en el panel (usuarios, cuentas del portal, empresa, categorías,
     marcas y activación de clientes o proveedores).
   Es de solo lectura; la Auditoría completa sigue en SIVEN. */
import { useEffect, useState } from 'react';
import { Tag } from '../../components/tables/Tag';
import { errorMessage, type Pagination } from '../../services/api/client';
import { fmtDateTime } from '../../utils/format';
import { accion, haceDias, MODULOS, quien } from './actividad';
import { adminApi, type Evento, type FiltroActividad } from './adminApi';
import { AdminHead, Paginador, Vacio } from './ui';

type Vista = 'access' | 'admin';

const EVENTOS: Record<Vista, Array<[string, string]>> = {
  access: [
    ['LOGIN', 'Inicios de sesión'],
    ['LOGIN_FAILED', 'Intentos fallidos'],
    ['LOGIN_BLOCKED', 'Usuarios inactivos'],
    ['LOGOUT', 'Cierres de sesión'],
    ['PASSWORD_RESET_REQUEST', 'Pidió recuperar contraseña'],
    ['PASSWORD_RESET', 'Recuperó su contraseña'],
  ],
  admin: [
    ['CREATE', 'Creado'],
    ['UPDATE', 'Modificado'],
    ['ACTIVATE', 'Activado'],
    ['DEACTIVATE', 'Desactivado'],
    ['RESET_PASSWORD', 'Contraseña restablecida'],
    ['REVOKE_SESSIONS', 'Sesiones cerradas'],
    ['DELETE', 'Eliminado'],
  ],
};

/** Tarjetas de los últimos 7 días (Accesos). */
const RESUMEN: Array<[string, string, string]> = [
  ['LOGIN', 'inicios de sesión', ''],
  ['LOGIN_FAILED', 'intentos fallidos', 'is-red'],
  ['LOGIN_BLOCKED', 'intentos de usuarios inactivos', 'is-amber'],
  ['PASSWORD_RESET', 'contraseñas recuperadas por correo', ''],
];

export function ActivityPage() {
  const [vista, setVista] = useState<Vista>('access');
  return (
    <>
      <AdminHead titulo="Actividad" desc="Quién entró, quién intentó entrar y qué se cambió en la administración. Es de solo lectura." />
      <div className="adm-seg" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={vista === 'access'} className={vista === 'access' ? 'is-on' : ''} onClick={() => setVista('access')}>
          Accesos
        </button>
        <button type="button" role="tab" aria-selected={vista === 'admin'} className={vista === 'admin' ? 'is-on' : ''} onClick={() => setVista('admin')}>
          Cambios de administración
        </button>
      </div>
      {vista === 'access' && <Resumen />}
      <Bitacora key={vista} vista={vista} />
    </>
  );
}

function Resumen() {
  const [n, setN] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const from = haceDias(6);
    Promise.all(RESUMEN.map(([action]) => adminApi.actividad({ scope: 'access', action, from, limit: 1 }).then((r) => [action, r.pagination?.total ?? 0] as const)))
      .then((pares) => setN(Object.fromEntries(pares)))
      .catch(() => setN({}));
  }, []);
  return (
    <div className="adm-stats">
      {RESUMEN.map(([action, label, tono]) => (
        <div key={action} className={tono}>
          <b>{n ? (n[action] ?? '—') : '—'}</b>
          <span>{label}</span>
        </div>
      ))}
      <div className="adm-stats-note">Últimos 7 días, en SIVEN y en el portal.</div>
    </div>
  );
}

function Bitacora({ vista }: { vista: Vista }) {
  const [usuario, setUsuario] = useState('');
  const [evento, setEvento] = useState('');
  const [desde, setDesde] = useState(haceDias(29));
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);
  const [filas, setFilas] = useState<Evento[] | null>(null);
  const [pag, setPag] = useState<Pagination | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      const f: FiltroActividad = {
        scope: vista,
        page,
        limit: 25,
        ...(usuario.trim() && { username: usuario.trim().replace(/^@/, '') }),
        ...(evento && { action: evento }),
        ...(desde && { from: desde }),
        ...(hasta && { to: hasta }),
      };
      adminApi
        .actividad(f)
        .then((r) => {
          if (!vivo) return;
          setFilas(r.items);
          setPag(r.pagination ?? null);
          setError('');
        })
        .catch((e) => vivo && setError(errorMessage(e)));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [vista, usuario, evento, desde, hasta, page]);

  const filtro = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Usuario</span>
          <input type="search" value={usuario} onChange={(e) => filtro(setUsuario)(e.target.value)} placeholder="Filtrar por usuario…" />
        </label>
        <select className="toolbar-select" value={evento} onChange={(e) => filtro(setEvento)(e.target.value)} aria-label="Evento">
          <option value="">{vista === 'access' ? 'Todos los eventos' : 'Todas las acciones'}</option>
          {EVENTOS[vista].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="adm-date">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => filtro(setDesde)(e.target.value)} />
        </label>
        <label className="adm-date">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => filtro(setHasta)(e.target.value)} />
        </label>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Usuario</th>
              <th>{vista === 'access' ? 'Evento' : 'Acción'}</th>
              <th>{vista === 'access' ? 'Dónde' : 'Sección'}</th>
              <th>Detalle</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {!filas && !error && <Vacio cols={6} msg="Cargando…" />}
            {filas && !filas.length && <Vacio cols={6} msg="No hay registros con estos filtros" />}
            {filas?.map((e) => {
              const [txt, tono] = accion(e.action);
              return (
                <tr key={e.id}>
                  <td className="mono">{fmtDateTime(e.createdAt)}</td>
                  <td className="mono">{quien(e)}</td>
                  <td>
                    <Tag tone={tono}>{txt}</Tag>
                  </td>
                  <td>{MODULOS[e.module] ?? e.module}</td>
                  <td className="adm-desc">{e.description ?? '—'}</td>
                  <td className="mono muted-sm">{e.ip ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Paginador p={pag} onPagina={setPage} />
    </>
  );
}
