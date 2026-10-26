/* MÓDULO: COTIZACIONES (RF-10 / RF-11) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import type { Cotizacion } from '../../types';
import { fmtDate, matches, money } from '../../utils/format';
import { SaleFormModal } from '../sales/SaleFormModal';
import { QuotationFormModal } from './QuotationFormModal';

export function QuotationsPage() {
  const { db, aprobarCotizacion, validarStockCotizacion } = useData();
  const modal = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const rows = db.cotizaciones.filter((c) => matches(q, c.codigo, fmtDate(c.fecha), c.cliN, money(c.total), c.validez, c.estado));

  const aprobar = (c: Cotizacion) => {
    const r = aprobarCotizacion(c.id);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data + ' aprobada', 'ok');
  };

  const convertir = (c: Cotizacion) => {
    const r = validarStockCotizacion(c.id);
    if (!r.ok) return toast(r.error, 'err');
    modal.open(
      <SaleFormModal
        title={`Convertir cotización ${c.codigo} a venta`}
        initialCliId={c.cli}
        initialLines={c.items.map((it) => ({ prod: it.prod, cant: it.cant }))}
        cotId={c.id}
      />,
    );
  };

  return (
    <>
      <ViewHead
        title="Cotizaciones"
        desc="Proformas con validez; las aprobadas se convierten en venta sin re-digitar (RF-11)."
        actions={
          <button className="b b-amber" onClick={() => modal.open(<QuotationFormModal />)}>
            + Nueva cotización
          </button>
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar cotización…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th className="num">Total</th>
              <th>Validez</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.cotizaciones.length && <EmptyRow cols={7} msg="Sin cotizaciones" />}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.codigo}</td>
                <td className="mono">{fmtDate(c.fecha)}</td>
                <td>{c.cliN}</td>
                <td className="num">{money(c.total)}</td>
                <td>{c.validez}</td>
                <td>
                  <EstadoTag estado={c.estado} />
                </td>
                <td>
                  {c.estado === 'Convertida' ? (
                    <Tag>Convertida</Tag>
                  ) : (
                    <>
                      {c.estado === 'Pendiente' && (
                        <>
                          <button className="b b-out b-sm" onClick={() => aprobar(c)}>
                            Aprobar
                          </button>{' '}
                        </>
                      )}
                      <button className="b b-green b-sm" onClick={() => convertir(c)}>
                        → Venta
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
