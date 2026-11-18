/* MÓDULO: CONSULTAS WEB (RF-17) — solicitudes enviadas desde el catálogo público. */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { ConsultaWeb, EstadoConsulta } from '../../types';
import { fmtDate } from '../../utils/format';

export function WebInquiriesPage() {
  const { db, cambiarEstadoConsulta } = useData();
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const cambiar = async (c: ConsultaWeb, estado: EstadoConsulta) => {
    setBusy(c.id);
    const r = await cambiarEstadoConsulta(c.id, estado);
    setBusy(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Consulta de ${c.nombre}: ${estado.toLowerCase()}`, 'ok');
  };

  return (
    <>
      <ViewHead title="Consultas Web" desc="Solicitudes enviadas por clientes desde el catálogo público (RF-17)." />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente / Empresa</th>
              <th>Contacto</th>
              <th>Producto de interés</th>
              <th>Mensaje</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.consultas.length && <EmptyRow cols={7} msg="Sin consultas" />}
            {db.consultas.map((c) => (
              <tr key={c.id}>
                <td className="mono">{fmtDate(c.fecha)}</td>
                <td>
                  <b>{c.nombre}</b>
                </td>
                <td className="mono">{c.contacto}</td>
                <td>{c.producto || '—'}</td>
                <td style={{ maxWidth: 280 }}>{c.msg}</td>
                <td>
                  <EstadoTag estado={c.estado} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {can('inquiries:write') && c.estado === 'Nueva' && (
                    <button className="b b-green b-sm" disabled={busy === c.id} onClick={() => cambiar(c, 'Atendida')}>
                      Marcar atendida
                    </button>
                  )}
                  {can('inquiries:write') && c.estado === 'Atendida' && (
                    <button className="b b-out b-sm" disabled={busy === c.id} onClick={() => cambiar(c, 'Cerrada')}>
                      Cerrar
                    </button>
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
