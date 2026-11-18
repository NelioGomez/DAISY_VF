/* MÓDULO: CLIENTES (RF-05) — filtros con chips y paginación (mejoras n.° 18-20). */
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
import type { Cliente } from '../../types';
import { money } from '../../utils/format';
import { useRecords } from '../records/records';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerRef } from './CustomerRef';

export function CustomersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('customers:write');
  const modal = useModal();
  const { openRecord } = useRecords();
  const selects: SelectFilter<Cliente>[] = [
    {
      key: 'saldo',
      label: 'Saldo',
      options: [
        { value: 'con', label: 'Con saldo pendiente' },
        { value: 'sin', label: 'Sin saldo' },
      ],
      test: (c, v) => (v === 'con' ? c.saldo > 0 : c.saldo <= 0),
    },
    {
      key: 'compras',
      label: 'Compras',
      options: [
        { value: 'con', label: 'Con compras' },
        { value: 'sin', label: 'Sin compras todavía' },
      ],
      test: (c, v) => (v === 'con' ? c.totalCompras > 0 : c.totalCompras <= 0),
    },
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'activo', label: 'Activos' },
        { value: 'inactivo', label: 'Inactivos' },
      ],
      test: (c, v) => (v === 'activo' ? c.activo : !c.activo),
    },
  ];
  const f = useListFilters(db.clientes, { search: (c) => [c.nombre, c.ruc, c.contacto, c.tel, c.correo, c.dir], selects });
  const pg = usePaged(f.filtered, f.key, 'clientes');

  const columns: Column<Cliente>[] = [
    {
      id: 'cliente',
      label: 'Cliente',
      required: true,
      cell: (c) => (
        <>
          <CustomerRef id={c.id}>
            <button
              className="link-btn"
              onClick={(e) => {
                e.stopPropagation();
                openRecord('cliente', c.id);
              }}
              title="Ver perfil 360°"
            >
              <b>{c.nombre}</b>
            </button>
          </CustomerRef>{' '}
          {!c.activo && <Tag>Inactivo</Tag>}
        </>
      ),
    },
    { id: 'ruc', label: 'RUC', cellClass: 'mono', cell: (c) => c.ruc },
    { id: 'contacto', label: 'Contacto', cell: (c) => c.contacto },
    { id: 'telefono', label: 'Teléfono', cellClass: 'mono', cell: (c) => c.tel },
    { id: 'correo', label: 'Correo', cell: (c) => c.correo || '—', hidden: true },
    { id: 'ciudad', label: 'Ciudad', cell: (c) => c.dir },
    { id: 'compras', label: 'Compras', className: 'num', cell: (c) => money(c.totalCompras) },
    {
      id: 'saldo',
      label: 'Saldo',
      className: 'num',
      cell: (c) => money(c.saldo),
      tdProps: (c) => (c.saldo > 0 ? { style: { color: 'var(--red)', fontWeight: 700 } } : {}),
    },
  ];
  const cols = useColumns('clientes', columns);
  const ncols = cols.visible.length + 1;

  return (
    <>
      <ViewHead
        title="Clientes"
        desc="Cartera comercial con RUC, contacto e historial."
        actions={
          canWrite && (
            <button className="b b-amber" onClick={() => modal.open(<CustomerFormModal />)}>
              + Nuevo cliente
            </button>
          )
        }
      />
      <FilterBar f={f} placeholder="Buscar por nombre, RUC, contacto, teléfono o correo…">
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
            {!db.clientes.length && <EmptyRow cols={ncols} msg="Sin clientes registrados" />}
            {!!db.clientes.length && !f.filtered.length && <EmptyRow cols={ncols} msg="Ningún cliente coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => openRecord('cliente', c.id)}>
                <ColumnCells cols={cols} row={c} />
                <td onClick={(e) => e.stopPropagation()}>
                  {canWrite && (
                    <button className="b b-out b-sm" onClick={() => modal.open(<CustomerFormModal cliente={c} />)}>
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="clientes" />
    </>
  );
}
