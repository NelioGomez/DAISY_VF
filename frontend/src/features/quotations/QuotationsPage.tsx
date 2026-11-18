/* MÓDULO: COTIZACIONES (RF-10 / RF-11)
   Flujo del servidor: Borrador → Pendiente → Aprobada → Convertida.
   Pendiente o Aprobada pueden rechazarse; vencen al pasar su validez.
   Muestra la antigüedad del estado (mejora n.° 15), el origen web (n.° 50) y una vista
   de pipeline por estado (n.° 14) alternable con la tabla; filtros con chips y paginación
   (n.° 18-20). En el pipeline las tarjetas se arrastran de una columna a otra (n.° 58) con las
   mismas reglas del servidor: Borrador → Pendiente → Aprobada → Convertida, y Pendiente o
   Aprobada → Rechazada. De Pendiente a Convertida se aprueba y se convierte en un paso. */
import { useRef, useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useBoardDrag } from '../../hooks/useBoardDrag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Cotizacion, EstadoCotizacion } from '../../types';
import { ago, daysSince, fmtDate, money } from '../../utils/format';
import { useOpenDocument } from '../documents/useOpenDocument';
import { CustomerRef } from '../customers/CustomerRef';
import { useRecords } from '../records/records';
import { SaleFormModal } from '../sales/SaleFormModal';
import { QuotationFormModal } from './QuotationFormModal';
import { RejectQuotationModal } from './RejectQuotationModal';

/** Días en Pendiente a partir de los cuales conviene dar seguimiento. */
const SEGUIMIENTO_DIAS = 5;

type Vista = 'tabla' | 'pipeline';
const VISTA_KEY = 'siven.cotizaciones.vista';
const PIPELINE: EstadoCotizacion[] = ['Borrador', 'Pendiente', 'Aprobada', 'Convertida', 'Rechazada', 'Vencida'];
/** En las columnas cerradas se muestran solo las más recientes. */
const MAX_CERRADAS = 20;
const CERRADAS: EstadoCotizacion[] = ['Convertida', 'Rechazada', 'Vencida'];

/** Columnas a las que se puede arrastrar una tarjeta según su estado (reglas del servidor). */
const MOVES: Partial<Record<EstadoCotizacion, EstadoCotizacion[]>> = {
  Borrador: ['Pendiente'],
  Pendiente: ['Aprobada', 'Convertida', 'Rechazada'],
  Aprobada: ['Convertida', 'Rechazada'],
};

const DROP_HINT: Partial<Record<EstadoCotizacion, string>> = {
  Pendiente: 'Soltar para enviarla al cliente',
  Aprobada: 'Soltar para aprobarla',
  Convertida: 'Soltar para convertirla en venta',
  Rechazada: 'Soltar para rechazarla',
};

function noPermitido(from: EstadoCotizacion, to: EstadoCotizacion): string {
  if (to === 'Vencida') return 'Las cotizaciones vencen solas al pasar su fecha de validez.';
  if (to === 'Borrador') return 'Una cotización enviada no vuelve a borrador.';
  if (from === 'Borrador') return 'Primero envíe el borrador: arrástrelo a Pendiente.';
  if (from === 'Aprobada' && to === 'Pendiente') return 'Una cotización aprobada no vuelve a Pendiente.';
  return `Una cotización ${from.toLowerCase()} no puede pasar a ${to.toLowerCase()}.`;
}

function readVista(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === 'pipeline' ? 'pipeline' : 'tabla';
  } catch {
    return 'tabla';
  }
}

export function QuotationsPage() {
  const { db, cambiarEstadoCotizacion, obtenerCotizacion } = useData();
  const { can } = useAuth();
  const canWrite = can('quotations:write');
  const canConvert = canWrite && can('sales:write');
  const modal = useModal();
  const toast = useToast();
  const doc = useOpenDocument();
  const { openRecord } = useRecords();
  const [busy, setBusy] = useState<string | null>(null);
  // Movimientos en curso en el pipeline: la tarjeta se ve ya en su nueva columna.
  const [moviendo, setMoviendo] = useState<Record<string, EstadoCotizacion>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<Vista>(readVista);
  const cambiarVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
  };
  const selects: SelectFilter<Cotizacion>[] = [
    { key: 'estado', label: 'Estado', options: PIPELINE.map((x) => ({ value: x, label: x })), test: (c, v) => c.estado === v },
    {
      key: 'origen',
      label: 'Origen',
      options: [
        { value: 'web', label: 'Solicitud web' },
        { value: 'interna', label: 'Interna' },
      ],
      test: (c, v) => (v === 'web' ? !!c.solicitud : !c.solicitud),
    },
    {
      key: 'seguimiento',
      label: 'Seguimiento',
      options: [{ value: 'si', label: `Pendientes hace ${SEGUIMIENTO_DIAS}+ días` }],
      test: (c) => c.estado === 'Pendiente' && daysSince(c.estadoDesde) >= SEGUIMIENTO_DIAS,
    },
  ];
  const f = useListFilters(db.cotizaciones, { search: (c) => [c.codigo, c.cliN, c.solicitud?.codigo], selects, date: (c) => c.fecha });
  const rows = f.filtered;
  const pg = usePaged(rows, f.key, 'cotizaciones');

  const transition = async (c: Cotizacion, accion: 'submit' | 'approve') => {
    setBusy(c.id);
    const r = await cambiarEstadoCotizacion(c.id, accion);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c.codigo} ${accion === 'approve' ? 'aprobada' : 'enviada'}`, 'ok');
  };

  const convertir = async (c: Cotizacion) => {
    setBusy(c.id);
    const r = await obtenerCotizacion(c.id);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    modal.open(<SaleFormModal cotizacion={r.data} />);
  };

  // ── Arrastrar y soltar en el pipeline (n.° 58) ──
  const puedeMover = (from: EstadoCotizacion, to: EstadoCotizacion) =>
    canWrite && !!MOVES[from]?.includes(to) && (to !== 'Convertida' || canConvert);
  const arrastrable = (c: Cotizacion) => canWrite && !!MOVES[c.estado]?.length && busy !== c.id && !moviendo[c.id];
  const estadoDe = (c: Cotizacion) => moviendo[c.id] ?? c.estado;

  const mover = async (c: Cotizacion, accion: 'submit' | 'approve', to: EstadoCotizacion) => {
    setMoviendo((m) => ({ ...m, [c.id]: to }));
    await transition(c, accion);
    setMoviendo((m) => {
      const rest = { ...m };
      delete rest[c.id];
      return rest;
    });
  };

  const soltar = (c: Cotizacion, to: EstadoCotizacion) => {
    if (to === 'Pendiente') return void mover(c, 'submit', to);
    if (to === 'Aprobada') return void mover(c, 'approve', to);
    if (to === 'Rechazada') return modal.open(<RejectQuotationModal cotizacion={c} />);
    if (to === 'Convertida') return void convertir(c);
  };

  const { active: dragging, over: dragOver, ghostRef, cardProps } = useBoardDrag<EstadoCotizacion>({
    scrollRef: boardRef,
    canDrop: (_id, from, to) => puedeMover(from, to),
    onDrop: (id, _from, to) => {
      const c = db.cotizaciones.find((x) => x.id === id);
      if (c) soltar(c, to);
    },
    onInvalid: (_id, from, to) => toast(to === 'Convertida' && !canConvert ? 'Su rol no puede registrar ventas.' : noPermitido(from, to), 'err'),
  });

  const tarjeta = (c: Cotizacion, ghost = false) => {
    const dias = daysSince(c.estadoDesde);
    const seguimiento = c.estado === 'Pendiente' && dias >= SEGUIMIENTO_DIAS;
    const cerrada = CERRADAS.includes(c.estado);
    const movible = !ghost && arrastrable(c);
    const clases = ['kcard', movible && 'is-draggable', !ghost && dragging?.id === c.id && 'is-dragging', moviendo[c.id] && 'is-moving'].filter(Boolean).join(' ');
    return (
      <article
        key={c.id}
        className={clases}
        onClick={ghost ? undefined : () => openRecord('cotizacion', c.id)}
        aria-busy={!!moviendo[c.id] || undefined}
        {...(movible ? cardProps(c.id, c.estado) : {})}
      >
        <div className="kcard-top">
          <button
            className="mono link-btn"
            tabIndex={ghost ? -1 : undefined}
            onClick={(e) => {
              e.stopPropagation();
              openRecord('cotizacion', c.id);
            }}
          >
            {c.codigo}
          </button>
          <span className="kcard-right">
            <b className="num">{money(c.total)}</b>
            {(movible || ghost) && (
              <span className="kcard-grip" data-grip title="Arrastrar a otra columna" aria-hidden="true" onClick={(e) => e.stopPropagation()}>
                ⠿
              </span>
            )}
          </span>
        </div>
        <div className="kcard-cli">{c.cliN}</div>
        <div className={`age ${seguimiento ? 'is-late' : ''}`} title={`Desde ${fmtDate(c.estadoDesde)}`}>
          {ago(c.estadoDesde)}
          {seguimiento && ' · dar seguimiento'}
          {c.solicitud && ` · ${c.solicitud.codigo}`}
        </div>
        {!cerrada && <div className="muted-sm">Válida hasta {fmtDate(c.validaHasta)}</div>}
        {!ghost && (
          <div className="kcard-actions" onClick={(e) => e.stopPropagation()}>
            {acciones(c)}
          </div>
        )}
      </article>
    );
  };
  const arrastrada = dragging ? db.cotizaciones.find((x) => x.id === dragging.id) : undefined;

  const acciones = (c: Cotizacion) => {
    const working = busy === c.id;
    if (c.estado === 'Convertida') return <Tag tone="t-violet">{c.factura ?? 'Convertida'}</Tag>;
    if (!canWrite || ['Rechazada', 'Vencida'].includes(c.estado)) return null;
    return (
      <>
        {c.estado === 'Borrador' && (
          <button className="b b-out b-sm" disabled={working} onClick={() => transition(c, 'submit')}>
            Enviar
          </button>
        )}
        {c.estado === 'Pendiente' && (
          <button className="b b-out b-sm" disabled={working} onClick={() => transition(c, 'approve')}>
            Aprobar
          </button>
        )}{' '}
        {c.estado === 'Aprobada' && canConvert && (
          <button className="b b-green b-sm" disabled={working} onClick={() => convertir(c)}>
            → Venta
          </button>
        )}{' '}
        {(c.estado === 'Pendiente' || c.estado === 'Aprobada') && (
          <button className="b b-red b-sm" disabled={working} onClick={() => modal.open(<RejectQuotationModal cotizacion={c} />)}>
            Rechazar
          </button>
        )}
      </>
    );
  };

  const columns: Column<Cotizacion>[] = [
    { id: 'codigo', label: 'Código', required: true, cellClass: 'mono', cell: (c) => c.codigo },
    { id: 'emision', label: 'Emisión', cellClass: 'mono', cell: (c) => fmtDate(c.fecha) },
    { id: 'cliente', label: 'Cliente', cell: (c) => <CustomerRef id={c.cli}>{c.cliN}</CustomerRef> },
    { id: 'vendedor', label: 'Vendedor', cell: (c) => c.vendedor || '—', hidden: true },
    {
      id: 'origen',
      label: 'Origen',
      cell: (c) =>
        c.solicitud ? (
          <DocChip tipo="SOLICITUD" codigo={c.solicitud.codigo} onOpen={doc.canOpen({ tipo: 'SOLICITUD' }) ? () => doc.open({ tipo: 'SOLICITUD', ...c.solicitud! }) : undefined} />
        ) : (
          <span className="muted-sm">Interna</span>
        ),
      tdProps: () => ({ onClick: (e) => e.stopPropagation() }),
    },
    { id: 'total', label: 'Total', className: 'num', cell: (c) => money(c.total) },
    { id: 'valida', label: 'Válida hasta', cellClass: 'mono', cell: (c) => fmtDate(c.validaHasta) },
    {
      id: 'estado',
      label: 'Estado',
      cell: (c) => {
        const seguimiento = c.estado === 'Pendiente' && daysSince(c.estadoDesde) >= SEGUIMIENTO_DIAS;
        return (
          <>
            <EstadoTag estado={c.estado} />
            <div className={`age ${seguimiento ? 'is-late' : ''}`} title={`Desde ${fmtDate(c.estadoDesde)}`}>
              {ago(c.estadoDesde)}
              {seguimiento && ' · dar seguimiento'}
            </div>
          </>
        );
      },
    },
  ];
  const cols = useColumns('cotizaciones', columns);
  const ncols = cols.visible.length + 1;

  return (
    <>
      <ViewHead
        title="Cotizaciones"
        desc="Proformas con validez de 15 días. Las aprobadas se convierten en venta sin volver a digitar (RF-11). Haga clic en una fila para ver el detalle y su origen."
        actions={
          canWrite && can('customers:read') && can('products:read') && (
            <button className="b b-amber" onClick={() => modal.open(<QuotationFormModal />)}>
              + Nueva cotización
            </button>
          )
        }
      />
      <FilterBar f={f} placeholder="Buscar cotización, cliente o solicitud…" dateLabel="Emitida">
        <div className="seg" role="group" aria-label="Vista">
          <button className={vista === 'tabla' ? 'on' : ''} aria-pressed={vista === 'tabla'} onClick={() => cambiarVista('tabla')}>
            Tabla
          </button>
          <button className={vista === 'pipeline' ? 'on' : ''} aria-pressed={vista === 'pipeline'} onClick={() => cambiarVista('pipeline')}>
            Pipeline
          </button>
        </div>
        {vista === 'tabla' && <ColumnsButton cols={cols} />}
      </FilterBar>
      {vista === 'pipeline' ? (
        <>
          {canWrite && (
            <p className="kanban-tip">
              Arrastre una tarjeta a otra columna para cambiar su estado; en celular, arrástrela desde <span aria-hidden="true">⠿</span>. Los botones de
              cada tarjeta hacen lo mismo.
            </p>
          )}
          <div ref={boardRef} className={`kanban ${dragging ? 'is-dragging' : ''}`} aria-label="Cotizaciones por estado">
            {PIPELINE.map((estado) => {
              const col = rows.filter((c) => estadoDe(c) === estado);
              const visibles = CERRADAS.includes(estado) ? col.slice(0, MAX_CERRADAS) : col;
              const a = dragging;
              const zona = !a ? '' : a.from === estado ? 'is-origin' : puedeMover(a.from, estado) ? 'is-drop-ok' : 'is-drop-no';
              return (
                <section
                  key={estado}
                  data-col={estado}
                  className={`kanban-col st-${estado.toLowerCase()} ${zona} ${a && dragOver === estado ? 'is-over' : ''}`}
                  aria-label={`${estado}: ${col.length}`}
                >
                  <h4>
                    <EstadoTag estado={estado} />
                    <span>
                      {col.length} · {money(col.reduce((t, c) => t + c.total, 0))}
                    </span>
                  </h4>
                  {zona === 'is-drop-ok' && <div className="kanban-drop">{DROP_HINT[estado]}</div>}
                  {visibles.map((c) => tarjeta(c))}
                  {!col.length && zona !== 'is-drop-ok' && <p className="kanban-empty">Sin cotizaciones</p>}
                  {col.length > visibles.length && <p className="kanban-empty">y {col.length - visibles.length} más en la tabla</p>}
                </section>
              );
            })}
          </div>
          {dragging && arrastrada && (
            <div ref={ghostRef} className="kanban-ghost" style={{ width: dragging.width }} aria-hidden="true">
              {tarjeta(arrastrada, true)}
            </div>
          )}
        </>
      ) : (
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.cotizaciones.length && <EmptyRow cols={ncols} msg="Sin cotizaciones" />}
            {!!db.cotizaciones.length && !rows.length && <EmptyRow cols={ncols} msg="Ninguna cotización coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((c) => {
              return (
                <tr key={c.id} className="row-link" onClick={() => openRecord('cotizacion', c.id)}>
                  <ColumnCells cols={cols} row={c} />
                  <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {acciones(c)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      {vista === 'tabla' && <Pagination p={pg} label="cotizaciones" />}
    </>
  );
}
