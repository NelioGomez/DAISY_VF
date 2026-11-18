/* MÓDULO: PROVEEDORES (RF-04) — filtros con chips y paginación (mejoras n.° 18-20). */
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Proveedor } from '../../types';
import { SupplierFormModal } from './SupplierFormModal';

export function SuppliersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('suppliers:write');
  const modal = useModal();
  const paises = [...new Set(db.proveedores.map((p) => p.pais).filter(Boolean))].sort();
  const selects: SelectFilter<Proveedor>[] = [
    {
      key: 'origen',
      label: 'Origen',
      options: [
        { value: 'nac', label: 'Nacionales' },
        { value: 'int', label: 'Internacionales' },
      ],
      test: (p, v) => (v === 'int' ? p.internacional : !p.internacional),
    },
    ...(paises.length > 1 ? [{ key: 'pais', label: 'País', options: paises.map((x) => ({ value: x, label: x })), test: (p: Proveedor, v: string) => p.pais === v }] : []),
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'activo', label: 'Activos' },
        { value: 'inactivo', label: 'Inactivos' },
      ],
      test: (p, v) => (v === 'activo' ? p.activo : !p.activo),
    },
  ];
  const f = useListFilters(db.proveedores, { search: (p) => [p.nombre, p.ruc, p.pais, p.contacto, p.tel, p.correo], selects });
  const pg = usePaged(f.filtered, f.key, 'proveedores');

  return (
    <>
      <ViewHead
        title="Proveedores"
        desc="Proveedores nacionales e internacionales."
        actions={
          canWrite && (
            <button className="b b-amber" onClick={() => modal.open(<SupplierFormModal />)}>
              + Nuevo proveedor
            </button>
          )
        }
      />
      <FilterBar f={f} placeholder="Buscar por nombre, RUC, país o contacto…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>RUC</th>
              <th>País</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.proveedores.length && <EmptyRow cols={7} msg="Sin proveedores" />}
            {!!db.proveedores.length && !f.filtered.length && <EmptyRow cols={7} msg="Ningún proveedor coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.nombre}</b>
                </td>
                <td className="mono">{p.ruc}</td>
                <td>
                  <Tag tone={p.internacional ? 't-blue' : 't-gray'}>{p.pais || '—'}</Tag>
                </td>
                <td>{p.contacto}</td>
                <td className="mono">{p.tel}</td>
                <td>{p.correo}</td>
                <td>
                  {canWrite && (
                    <button className="b b-out b-sm" onClick={() => modal.open(<SupplierFormModal proveedor={p} />)}>
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="proveedores" />
    </>
  );
}
