/* MÓDULO: AUDITORÍA (RF-22 / RNF-09)
   Bitácora paginada y filtrada en el servidor (mejoras n.° 18-20): búsqueda, módulo, usuario y
   fechas con chips; la exportación respeta los filtros. */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { ErrorRow } from '../../components/feedback/ErrorState';
import { SkeletonRows } from '../../components/feedback/Skeleton';
import { useToast } from '../../components/feedback/useToast';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useDebounced } from '../../hooks/useDebounced';
import { useFilterState, type SelectDef } from '../../hooks/useListFilters';
import { useServerPage } from '../../hooks/useServerPage';
import { errorMessage, getAll } from '../../services/api/client';
import { mapAuditoria } from '../../services/api/mappers';
import { exportCSV } from '../../utils/csv';
import { fmtDateTime } from '../../utils/format';

/** Cualquier operación deja un registro: la página visible se actualiza con los avisos en tiempo real. */
const MODULES = [
  'products', 'categories', 'brands', 'inventory', 'purchases', 'production', 'sales', 'payments', 'quotations',
  'customers', 'suppliers', 'service-orders', 'inquiries', 'users', 'roles', 'settings',
] as const;

const MODULOS: Array<[string, string]> = [
  ['auth', 'Seguridad'],
  ['users', 'Usuarios'],
  ['products', 'Productos'],
  ['inventory', 'Inventario'],
  ['purchases', 'Compras'],
  ['production', 'Producción'],
  ['sales', 'Ventas'],
  ['payments', 'Pagos'],
  ['quotations', 'Cotizaciones'],
  ['customers', 'Clientes'],
  ['suppliers', 'Proveedores'],
  ['service-orders', 'OPI'],
  ['inquiries', 'Consultas'],
  ['portal', 'Portal clientes'],
  ['customer-accounts', 'Cuentas del portal'],
  ['categories', 'Categorías'],
  ['brands', 'Marcas'],
  ['reports', 'Reportes'],
  ['settings', 'Configuración'],
];

const SELECTS: SelectDef[] = [{ key: 'module', label: 'Módulo', options: MODULOS.map(([value, label]) => ({ value, label })) }];

export function AuditPage() {
  const toast = useToast();
  const f = useFilterState(SELECTS, true);
  const [usuario, setUsuario] = useState('');
  const search = useDebounced(f.q.trim(), 350);
  const user = useDebounced(usuario.trim().replace(/^@/, ''), 350);
  const query = {
    search: search || undefined,
    module: f.values.module || undefined,
    username: user || undefined,
    from: f.desde || undefined,
    to: f.hasta || undefined,
  };
  const { rows, loading, error, reload, pager } = useServerPage('/audit', query, mapAuditoria, MODULES, 'auditoria');
  const [exporting, setExporting] = useState(false);

  const exportar = async () => {
    setExporting(true);
    try {
      const all = (await getAll<unknown>('/audit', query, 20)).items.map(mapAuditoria);
      const file = 'auditoria_norcor.csv';
      exportCSV(file, [['Fecha', 'Usuario', 'Modulo', 'Accion', 'Detalle', 'IP'], ...all.map((l) => [l.fecha, l.usuario, l.modulo, l.accion, l.detalle, l.ip])]);
      toast(`Exportado: ${file} (${all.length} registros)`, 'ok');
    } catch (e) {
      toast(errorMessage(e), 'err');
    } finally {
      setExporting(false);
    }
  };

  const limpiar = () => {
    f.clear();
    setUsuario('');
  };
  const chips = user ? { ...f, active: [...f.active, { key: 'usuario', label: `Usuario: @${user}`, clear: () => setUsuario('') }], clear: limpiar } : f;

  return (
    <>
      <ViewHead
        title="Auditoría"
        desc="Bitácora que registra el servidor: fecha, usuario, módulo, acción e IP (RNF-09). Es de solo lectura; filtre por módulo, usuario o fechas y exporte el resultado."
        actions={
          <button className="b b-out" onClick={exportar} disabled={exporting || !pager.total}>
            {exporting ? 'Exportando…' : '⬇ Exportar CSV'}
          </button>
        }
      />
      <FilterBar f={chips} placeholder="Buscar en la descripción…">
        <div className="search search-sm">
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="@usuario" aria-label="Usuario" />
        </div>
      </FilterBar>
      <div className={`tablewrap ${loading && rows ? 'is-loading' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Fecha / hora</th>
              <th>Usuario</th>
              <th>Módulo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {error && <ErrorRow cols={4} msg={error} onRetry={reload} />}
            {!rows && !error && <SkeletonRows cols={4} />}
            {rows && !rows.length && !error && <EmptyRow cols={4} msg={chips.active.length ? 'Ningún registro coincide con los filtros' : 'Sin registros'} ic={chips.active.length ? '🔍' : '📭'} />}
            {rows?.map((l) => (
              <tr key={l.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {fmtDateTime(l.fecha)}
                </td>
                <td className="mono">@{l.usuario}</td>
                <td>
                  <Tag>{l.modulo}</Tag>
                </td>
                <td>
                  {l.detalle}
                  <span className="mono" style={{ fontSize: 11, color: 'var(--soft)' }}>
                    {' '}
                    {l.accion}
                    {l.ip && ` · ${l.ip}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pager} label="registros" />
    </>
  );
}
