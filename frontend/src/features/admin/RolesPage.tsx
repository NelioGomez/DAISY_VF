/* Administración › Roles y permisos: qué puede consultar y qué puede registrar cada rol, leído del
   servidor. Es de consulta: el menú de SIVEN depende de estos roles, así que no se editan aquí. */
import { useEffect, useState } from 'react';
import { ROLES } from '../../config/navigation';
import { errorMessage } from '../../services/api/client';
import { ROLE_FROM_API } from '../../services/api/mappers';
import { adminApi, type RolAdmin, type UsuarioAdmin } from './adminApi';
import { AdminHead } from './ui';

const AREAS: Array<[string, string]> = [
  ['dashboard', 'Dashboard'],
  ['reports', 'Reportes'],
  ['products', 'Productos'],
  ['prices', 'Precios'],
  ['categories', 'Categorías'],
  ['brands', 'Marcas'],
  ['inventory', 'Inventario'],
  ['purchases', 'Compras'],
  ['suppliers', 'Proveedores'],
  ['production', 'Producción'],
  ['quality', 'Control de calidad'],
  ['customers', 'Clientes'],
  ['quotations', 'Cotizaciones'],
  ['sales', 'Ventas'],
  ['payments', 'Pagos y CxC'],
  ['service-orders', 'Órdenes de servicio'],
  ['inquiries', 'Consultas web'],
  ['catalog', 'Catálogo web'],
  ['audit', 'Auditoría'],
  ['users', 'Usuarios'],
  ['settings', 'Configuración'],
];
const ORDEN = ['ADMIN', 'MANAGEMENT', 'SELLER', 'INVENTORY_MANAGER', 'ACCOUNTING', 'TECHNICIAN'];

function Celda({ permisos, area }: { permisos: string[]; area: string }) {
  const escribe = permisos.includes(`${area}:write`);
  const lee = permisos.includes(`${area}:read`);
  const anula = area === 'sales' && permisos.includes('sales:void');
  if (escribe) return <span className="adm-perm is-w">Registra{anula ? ' y anula' : ''}</span>;
  if (lee) return <span className="adm-perm is-r">Consulta</span>;
  return <span className="adm-perm">—</span>;
}

export function RolesPage() {
  const [roles, setRoles] = useState<RolAdmin[] | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([adminApi.roles(), adminApi.usuarios()])
      .then(([r, u]) => {
        setRoles([...r].sort((a, b) => ORDEN.indexOf(a.code) - ORDEN.indexOf(b.code)));
        setUsuarios(u);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <AdminHead titulo="Roles y permisos" desc="Qué puede hacer cada rol en SIVEN. Para cambiar lo que puede hacer una persona, cámbiele el rol en Usuarios." />
      {error && <div className="adm-error">{error}</div>}
      {roles && (
        <>
          <div className="adm-roles">
            {roles.map((r) => {
              const key = ROLE_FROM_API[r.code];
              const n = usuarios.filter((u) => u.role.code === r.code && u.isActive).length;
              return (
                <div key={r.id} className="adm-role-card" style={{ ['--rc' as string]: ROLES[key].color }}>
                  <b>{ROLES[key].name}</b>
                  <span>
                    {n} usuario{n === 1 ? '' : 's'} activo{n === 1 ? '' : 's'}
                  </span>
                  {r.description && <small>{r.description}</small>}
                </div>
              );
            })}
          </div>
          <div className="tablewrap">
            <table className="adm-matrix">
              <thead>
                <tr>
                  <th>Área</th>
                  {roles.map((r) => (
                    <th key={r.id}>{ROLES[ROLE_FROM_API[r.code]].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map(([area, nombre]) => (
                  <tr key={area}>
                    <td>
                      <b>{nombre}</b>
                    </td>
                    {roles.map((r) => (
                      <td key={r.id}>
                        <Celda permisos={r.permissions} area={area} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted-sm" style={{ marginTop: 10 }}>
            <b>Registra</b> = puede crear y modificar · <b>Consulta</b> = solo ver · <b>—</b> = sin acceso. El técnico, además, solo ve las órdenes de servicio asignadas a él.
          </p>
        </>
      )}
    </>
  );
}
