/* MÓDULO: ÓRDENES DE SERVICIO / OPI (RF-21) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { OPI_FLOW } from '../../config/business';
import { useData } from '../../store/hooks';
import { fmtDate, matches } from '../../utils/format';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';

export function ServiceOrdersPage() {
  const { db, avanzarOrden, cancelarOrden } = useData();
  const modal = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const rows = db.ordenes.filter((o) => matches(q, o.codigo, fmtDate(o.fecha), o.cli, o.desc, o.tecnico, o.estado));

  const avanzar = (id: string) => {
    const r = avanzarOrden(id);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data, 'ok');
  };
  const cancelar = (id: string) => {
    const r = cancelarOrden(id);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data + ' cancelada', 'err');
  };

  return (
    <>
      <ViewHead
        title="Órdenes de Servicio (OPI)"
        desc="Flujo: Registrada → Asignada → En proceso → Completada → Facturada."
        actions={
          <button className="b b-amber" onClick={() => modal.open(<ServiceOrderFormModal />)}>
            + Nueva orden
          </button>
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar orden…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Descripción</th>
              <th>Técnico</th>
              <th>Estado</th>
              <th>Avanzar</th>
            </tr>
          </thead>
          <tbody>
            {!db.ordenes.length && <EmptyRow cols={7} msg="Sin órdenes" />}
            {rows.map((o) => {
              const idx = OPI_FLOW.indexOf(o.estado);
              const next = idx >= 0 && idx < OPI_FLOW.length - 1 ? OPI_FLOW[idx + 1] : null;
              const cerrada = o.estado === 'Cancelada' || o.estado === 'Facturada';
              return (
                <tr key={o.id}>
                  <td className="mono">{o.codigo}</td>
                  <td className="mono">{fmtDate(o.fecha)}</td>
                  <td>{o.cli}</td>
                  <td style={{ maxWidth: 260 }}>{o.desc}</td>
                  <td>{o.tecnico}</td>
                  <td>
                    <EstadoTag estado={o.estado} />
                  </td>
                  <td>
                    {cerrada ? (
                      <Tag>Cerrada</Tag>
                    ) : (
                      <>
                        {next && (
                          <>
                            <button className="b b-green b-sm" onClick={() => avanzar(o.id)}>
                              → {next}
                            </button>{' '}
                          </>
                        )}
                        <button className="b b-red b-sm" onClick={() => cancelar(o.id)}>
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
