/* MÓDULO: AUDITORÍA (RF-22 / RNF-09) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import { exportCSV } from '../../utils/csv';
import { fmtDateTime, matches } from '../../utils/format';

export function AuditPage() {
  const { db } = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const rows = db.auditoria.filter((l) => matches(q, fmtDateTime(l.fecha), '@' + l.usuario, l.modulo, l.accion, l.detalle, l.ip));

  const exportar = () => {
    const file = 'auditoria_norcor.csv';
    exportCSV(file, [['Fecha', 'Usuario', 'Modulo', 'Accion', 'Detalle', 'IP'], ...db.auditoria.map((l) => [l.fecha, l.usuario, l.modulo, l.accion, l.detalle, l.ip])]);
    toast('Exportado: ' + file, 'ok');
  };

  return (
    <>
      <ViewHead
        title="Auditoría"
        desc="Bitácora que registra el servidor: fecha, usuario, módulo, acción e IP (RNF-09). Se muestran los 100 eventos más recientes."
        actions={
          <button className="b b-out" onClick={exportar}>
            ⬇ Exportar CSV
          </button>
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar en bitácora…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Fecha / hora</th>
              <th>Usuario</th>
              <th>Módulo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {!db.auditoria.length && <EmptyRow cols={4} msg="Sin registros" />}
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {fmtDateTime(l.fecha)}
                </td>
                <td className="mono">@{l.usuario}</td>
                <td>
                  <Tag>{l.modulo}</Tag>
                </td>
                <td>
                  {l.detalle}
                  <span className="mono" style={{ fontSize: 11, color: 'var(--soft)' }}>
                    {' '}
                    {l.accion}
                    {l.ip && ` · ${l.ip}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
