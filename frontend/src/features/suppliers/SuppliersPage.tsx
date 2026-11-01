/* MÓDULO: PROVEEDORES (RF-04) — filtros con chips y paginación (mejoras n.° 18-20), columnas
   configurables (n.° 21) y panel lateral del proveedor con dirección propia (n.° 32-33). */
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Proveedor } from '../../types';
import { useRecords } from '../records/records';
import { SupplierFormModal } from './SupplierFormModal';

export function SuppliersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('suppliers:write');
  const modal = useModal();
  const { openRecord } = useRecords();
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
  const columns: Column<Proveedor>[] = [
    {
      id: 'proveedor',
      label: 'Proveedor',
      required: true,
      cell: (p) => (
        <>
          <button
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              openRecord('proveedor', p.id);
            }}
            title="Ver compras y productos del proveedor"
          >
            <b>{p.nombre}</b>
          </button>{' '}
          {!p.activo && <Tag>Inactivo</Tag>}
        </>
      ),
    },
    { id: 'ruc', label: 'RUC', cellClass: 'mono', cell: (p) => p.ruc },
    { id: 'pais', label: 'País', cell: (p) => <Tag tone={p.internacional ? 't-blue' : 't-gray'}>{p.pais || '—'}</Tag> },
    { id: 'contacto', label: 'Contacto', cell: (p) => p.contacto },
    { id: 'telefono', label: 'Teléfono', cellClass: 'mono', cell: (p) => p.tel },
    { id: 'correo', label: 'Correo', cell: (p) => p.correo },
    { id: 'direccion', label: 'Dirección', cell: (p) => p.dir || '—', hidden: true },
  ];
  const cols = useColumns('proveedores', columns);
  const ncols = cols.visible.length + 1;

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
      <FilterBar f={f} placeholder="Buscar por nombre, RUC, país o contacto…">
        <ColumnsButton cols={cols} />
      </FilterBar>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.proveedores.length && <EmptyRow cols={ncols} msg="Sin proveedores" />}
            {!!db.proveedores.length && !f.filtered.length && <EmptyRow cols={ncols} msg="Ningún proveedor coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => (
              <tr key={p.id} className="row-link" onClick={() => openRecord('proveedor', p.id)}>
                <ColumnCells cols={cols} row={p} />
                <td onClick={(e) => e.stopPropagation()}>
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
