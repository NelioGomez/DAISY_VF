/* MÓDULO: COMPRAS (mejoras n.° 41, 48 y 2 del análisis UX)
   Ciclo de reposición: Stock crítico → Sugerencia → Compra → Pendiente de recibir →
   Recepción → Entrada de inventario. La pestaña Reabastecimiento propone qué comprar.
   Filtros con chips y paginación (n.° 18-20). */
import { useSearchParams } from 'react-router-dom';
import { KpiCard } from '../../components/cards/KpiCard';
import { ViewHead } from '../../components/common/ViewHead';
import { Tabs } from '../../components/common/Tabs';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Compra, EstadoCompra } from '../../types';
import { fmtDate, money } from '../../utils/format';
import { useRecords } from '../records/records';
import { PurchaseFormModal } from './PurchaseFormModal';
import { RestockPanel } from './RestockPanel';
import { moneyIn } from './purchaseFormat';

type Tab = 'ordenes' | 'reabastecimiento';
const ESTADOS: EstadoCompra[] = ['Borrador', 'Ordenada', 'Parcial', 'Recibida', 'Cancelada'];

export function PurchasesPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('purchases:write');
  const modal = useModal();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'reabastecimiento' ? 'reabastecimiento' : 'ordenes';

  const r = db.comprasResumen;
  const atrasadas = db.compras.filter((c) => c.atrasada).length;
  const proveedores = [...new Set(db.compras.map((c) => c.proveedor))].sort();
  const selects: SelectFilter<Compra>[] = [
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'pendientes', label: 'Pendientes de recibir' },
        { value: 'atrasadas', label: 'Atrasadas' },
        ...ESTADOS.map((x) => ({ value: x, label: x })),
      ],
      test: (c, v) => (v === 'pendientes' ? c.estado === 'Ordenada' || c.estado === 'Parcial' : v === 'atrasadas' ? !!c.atrasada : c.estado === v),
    },
    { key: 'proveedor', label: 'Proveedor', options: proveedores.map((x) => ({ value: x, label: x })), test: (c, v) => c.proveedor === v },
    {
      key: 'moneda',
      label: 'Moneda',
      options: [
        { value: 'NIO', label: 'Córdobas' },
        { value: 'USD', label: 'Dólares' },
      ],
      test: (c, v) => c.moneda === v,
    },
  ];
  const f = useListFilters(db.compras, { search: (c) => [c.codigo, c.proveedor, c.notas], selects, date: (c) => c.ordenada ?? c.fecha });
  const rows = f.filtered;
  const pg = usePaged(rows, f.key, 'compras');

  const setTab = (t: Tab) => setParams(t === 'ordenes' ? {} : { tab: t }, { replace: true });
  const { openRecord } = useRecords();
  const abrir = (c: Compra) => openRecord('compra', c.id);
  const columns: Column<Compra>[] = [
    { id: 'codigo', label: 'Código', required: true, cellClass: 'mono', cell: (c) => c.codigo },
    { id: 'fecha', label: 'Fecha', cellClass: 'mono', cell: (c) => fmtDate(c.ordenada ?? c.fecha) },
    {
      id: 'proveedor',
      label: 'Proveedor',
      cell: (c) => (
        <>
          {c.proveedor} {c.internacional && <Tag tone="t-blue">Int.</Tag>}
        </>
      ),
    },
    { id: 'estado', label: 'Estado', cell: (c) => <EstadoTag estado={c.estado} /> },
    {
      id: 'recibido',
      label: 'Recibido',
      cell: (c) => {
        const pct = c.unidades ? Math.round((c.recibidas / c.unidades) * 100) : 0;
        return (
          <>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Recibido ${pct}%`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-txt">
              {c.recibidas} / {c.unidades} u.
            </span>
          </>
        );
      },
      tdProps: () => ({ style: { minWidth: 130 } }),
    },
    { id: 'moneda', label: 'Moneda', cell: (c) => (c.moneda === 'USD' ? 'Dólares' : 'Córdobas'), hidden: true },
    {
      id: 'total',
      label: 'Total',
      className: 'num',
      cell: (c) => (
        <>
          {moneyIn(c.total, c.moneda)}
          {c.moneda === 'USD' && <div className="sub-num">{money(c.totalNio)}</div>}
        </>
      ),
    },
    {
      id: 'esperada',
      label: 'Esperada',
      cellClass: 'mono',
      cell: (c) => (
        <>
          {fmtDate(c.esperada)}
          {c.atrasada && ' ⚠'}
        </>
      ),
      tdProps: (c) => (c.atrasada ? { style: { color: 'var(--red)', fontWeight: 700 } } : {}),
    },
    { id: 'notas', label: 'Notas', cell: (c) => c.notas || '—', hidden: true },
  ];
  const cols = useColumns('compras', columns);
  const ncols = cols.visible.length + 1;

  return (
    <>
      <ViewHead
        title="Compras"
        desc="Órdenes de compra a proveedores. Al registrar la recepción, el servidor genera las entradas de inventario y recalcula el costo promedio con el costo real (incluye flete y gastos)."
        actions={
          canWrite && (
            <button className="b b-amber" onClick={() => modal.open(<PurchaseFormModal />)}>
              + Nueva compra
            </button>
          )
        }
      />

      <Tabs
        label="Secciones de compras"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'ordenes', label: 'Órdenes de compra', count: r?.pendientes },
          { id: 'reabastecimiento', label: 'Reabastecimiento' },
        ]}
      />

      {tab === 'reabastecimiento' ? (
        <RestockPanel />
      ) : (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <KpiCard lbl="Pendientes de recibir" val={r?.pendientes ?? 0} sub={`${r?.porEstado.Parcial ?? 0} con recepción parcial`} ic="◷" tone={r?.pendientes ? 'warn' : 'good'} />
            <KpiCard lbl="Comprado (30 días)" val={money(r?.comprado30.monto ?? 0)} sub={`${r?.comprado30.compras ?? 0} órdenes · en C$`} ic="⇩" />
            <KpiCard lbl="Recibidas" val={r?.porEstado.Recibida ?? 0} sub="órdenes completas" ic="✓" />
            <KpiCard lbl="Atrasadas" val={atrasadas} sub="pasaron la fecha esperada" ic="⚠" tone={atrasadas ? 'warn' : 'good'} />
          </div>

          <FilterBar f={f} placeholder="Buscar por código, proveedor o notas…">
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
                {!db.compras.length && <EmptyRow cols={ncols} msg="Aún no hay compras. Use «Nueva compra» o la pestaña Reabastecimiento." ic="⇩" />}
                {!!db.compras.length && !rows.length && <EmptyRow cols={ncols} msg="Ninguna compra coincide con los filtros" ic="🔍" />}
                {pg.pageRows.map((c) => {
                  return (
                    <tr key={c.id} className="row-link" onClick={() => abrir(c)}>
                      <ColumnCells cols={cols} row={c} />
                      <td>
                        <button
                          className="b b-out b-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrir(c);
                          }}
                        >
                          {canWrite && (c.estado === 'Ordenada' || c.estado === 'Parcial') ? 'Recibir' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination p={pg} label="compras" />
        </>
      )}
    </>
  );
}
