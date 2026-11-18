/* MÓDULO: CLIENTES (RF-05) — filtros con chips y paginación (mejoras n.° 18-20). */
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Cliente } from '../../types';
import { money } from '../../utils/format';
import { CustomerDrawer } from './CustomerDrawer';
import { CustomerFormModal } from './CustomerFormModal';

export function CustomersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('customers:write');
  const modal = useModal();
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
      <FilterBar f={f} placeholder="Buscar por nombre, RUC, contacto, teléfono o correo…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>RUC</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th className="num">Compras</th>
              <th className="num">Saldo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.clientes.length && <EmptyRow cols={8} msg="Sin clientes registrados" />}
            {!!db.clientes.length && !f.filtered.length && <EmptyRow cols={8} msg="Ningún cliente coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="link-btn" onClick={() => modal.open(<CustomerDrawer clienteId={c.id} />)} title="Ver perfil 360°">
                    <b>{c.nombre}</b>
                  </button>{' '}
                  {!c.activo && <Tag>Inactivo</Tag>}
                </td>
                <td className="mono">{c.ruc}</td>
                <td>{c.contacto}</td>
                <td className="mono">{c.tel}</td>
                <td>{c.dir}</td>
                <td className="num">{money(c.totalCompras)}</td>
                <td className="num" style={c.saldo > 0 ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                  {money(c.saldo)}
                </td>
                <td>
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
