/* Rotación de inventario y días de inventario (mejoras n.° 11 y 12): qué se vende rápido, qué
   alcanza para meses y cuánto dinero está detenido en productos sin movimiento. */
import { useState } from 'react';
import { EmptyRow } from '../../components/feedback/Empty';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SkeletonRows } from '../../components/feedback/Skeleton';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useRemoteData } from '../../hooks/useRemoteData';
import { useData } from '../../store/hooks';
import type { Rotacion } from '../../types';
import { exportCSV } from '../../utils/csv';
import { ago, fmtDate, money } from '../../utils/format';
import { cargarRotacion, CLASES, ROTACION, type FilaRotacion } from './rotation';
import { ProductRef } from '../products/ProductRef';
import { useRecords } from '../records/records';

const MODULES = ['sales', 'inventory', 'purchases', 'production', 'products'] as const;
const NO_ROWS: FilaRotacion[] = [];

type Orden = 'dias' | 'valor' | 'vendidas';
const ORDEN: Record<Orden, { txt: string; cmp(a: FilaRotacion, b: FilaRotacion): number }> = {
  dias: { txt: 'Más días de inventario', cmp: (a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity) || b.valor - a.valor },
  valor: { txt: 'Mayor valor en stock', cmp: (a, b) => b.valor - a.valor },
  vendidas: { txt: 'Más usados (90 días)', cmp: (a, b) => b.vendidas90 - a.vendidas90 },
};

export function RotationPanel() {
  const { db } = useData();
  const { openRecord } = useRecords();
  const { data, error, reload } = useRemoteData(cargarRotacion, MODULES);
  const [orden, setOrden] = useState<Orden>('dias');
  const selects: SelectFilter<FilaRotacion>[] = [
    { key: 'rotacion', label: 'Rotación', options: CLASES.map((c) => ({ value: c, label: ROTACION[c].corto })), test: (r, v) => r.rotacion === v },
    { key: 'categoria', label: 'Categoría', options: db.categorias.map((c) => ({ value: c.nombre, label: c.nombre })), test: (r, v) => r.categoria === v },
  ];
  const f = useListFilters(data?.filas ?? NO_ROWS, { search: (r) => [r.sku, r.nombre, r.marca, r.categoria], selects });
  const ordenadas = [...f.filtered].sort(ORDEN[orden].cmp);
  const pg = usePaged(ordenadas, f.key + orden, 'inventario-rotacion');

  if (error && !data) return <ErrorState msg={error} onRetry={reload} />;

  const exportar = () =>
    exportCSV('rotacion_inventario.csv', [
      ['SKU', 'Producto', 'Categoría', 'Stock', 'Uso 30 días', 'Uso 90 días', 'Consumo producción 90 días', 'Uso por día', 'Días de inventario', 'Rotación', 'Último uso', 'Valor en stock'],
      ...ordenadas.map((r) => [r.sku, r.nombre, r.categoria, r.stock, r.vendidas30, r.vendidas90, r.consumidas90, r.porDia, r.dias ?? '', ROTACION[r.rotacion].corto, r.ultimaVenta ? fmtDate(r.ultimaVenta) : '', r.valor.toFixed(2)]),
    ]);
  const elegir = (c: Rotacion) => f.setValue('rotacion', f.values.rotacion === c ? '' : c);

  return (
    <>
      <div className="rot-cards" role="group" aria-label="Productos por rotación">
        {CLASES.map((c) => {
          const s = data?.porClase[c];
          return (
            <button key={c} type="button" className={`rot-card rot-${c.toLowerCase()} ${f.values.rotacion === c ? 'on' : ''}`} onClick={() => elegir(c)} aria-pressed={f.values.rotacion === c}>
              <span className="rot-lbl">
                <span aria-hidden="true">{ROTACION[c].ic}</span> {ROTACION[c].corto}
              </span>
              <b>{s ? s.productos : '—'}</b>
              <small>{s ? `${money(s.valor)} en stock` : ROTACION[c].ayuda}</small>
            </button>
          );
        })}
      </div>

      <FilterBar f={f} placeholder="Buscar producto…">
        <select className="toolbar-select" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Ordenar">
          {(Object.keys(ORDEN) as Orden[]).map((k) => (
            <option key={k} value={k}>
              {ORDEN[k].txt}
            </option>
          ))}
        </select>
        <button className="b b-out" onClick={exportar} disabled={!ordenadas.length}>
          ⇩ CSV
        </button>
      </FilterBar>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Stock</th>
              <th className="num" title="Ventas + consumo en producción">
                Uso 30 d
              </th>
              <th className="num" title="Ventas + consumo en producción">
                Uso 90 d
              </th>
              <th className="num" title="Promedio de unidades usadas por día en los últimos 90 días">
                Por día
              </th>
              <th className="num" title="Cuántos días alcanza el stock al ritmo de venta actual">
                Días de inventario
              </th>
              <th>Rotación</th>
              <th>Último uso</th>
              <th className="num">Valor en stock</th>
            </tr>
          </thead>
          <tbody>
            {!data && <SkeletonRows cols={9} />}
            {data && !data.filas.length && <EmptyRow cols={9} msg="Sin productos activos" />}
            {data && !!data.filas.length && !ordenadas.length && <EmptyRow cols={9} msg="Ningún producto coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((r) => (
              <tr key={r.id}>
                <td>
                  <ProductRef id={r.id}>
                    <button className="link-btn" onClick={() => openRecord('producto', r.id)}>
                      {r.nombre}
                    </button>
                  </ProductRef>
                  <div className="sub-num mono">{r.sku}</div>
                </td>
                <td className="num">{r.stock}</td>
                <td className="num">{r.vendidas30}</td>
                <td className="num">
                  {r.vendidas90}
                  {r.consumidas90 > 0 && <div className="sub-num">{r.consumidas90} en producción</div>}
                </td>
                <td className="num">{r.porDia.toLocaleString('es-NI', { maximumFractionDigits: 2 })}</td>
                <td className="num">{r.dias === null ? '—' : r.dias.toLocaleString('es-NI')}</td>
                <td>
                  <Tag tone={ROTACION[r.rotacion].tone}>
                    <span aria-hidden="true">{ROTACION[r.rotacion].ic}</span> {ROTACION[r.rotacion].corto}
                  </Tag>
                </td>
                <td>{r.ultimaVenta ? <span title={fmtDate(r.ultimaVenta)}>{ago(r.ultimaVenta)}</span> : <span className="muted-sm">nunca</span>}</td>
                <td className="num">{money(r.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="productos" />
      <div className="note" style={{ marginTop: 12 }}>
        <span className="ic">ℹ️</span>
        <div>
          <b>Días de inventario</b> = stock ÷ uso por día de los últimos 90 días (uso = ventas + consumo en producción). Rotación <b>alta</b>: alcanza 30 días o
          menos; <b>media</b>: 31 a 90; <b>baja</b>: más de 90; <b>sin movimiento</b>: ni se vendió ni se consumió en 90 días (dinero detenido: revise precio,
          promoción o no volver a comprar).
        </div>
      </div>
    </>
  );
}
