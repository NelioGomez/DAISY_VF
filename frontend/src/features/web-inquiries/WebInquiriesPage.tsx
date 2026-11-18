/* MÓDULO: CONSULTAS WEB (RF-17) */
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useToast } from '../../components/feedback/useToast';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import { fmtDate } from '../../utils/format';

export function WebInquiriesPage() {
  const { db, atenderConsulta } = useData();
  const toast = useToast();

  const atender = (id: string) => {
    atenderConsulta(id);
    toast('Consulta atendida', 'ok');
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
              <th>Mensaje</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.consultas.length && <EmptyRow cols={6} msg="Sin consultas" />}
            {db.consultas.map((c) => (
              <tr key={c.id}>
                <td className="mono">{fmtDate(c.fecha)}</td>
                <td>
                  <b>{c.nombre}</b>
                </td>
                <td className="mono">{c.contacto}</td>
                <td style={{ maxWidth: 280 }}>{c.msg}</td>
                <td>
                  <EstadoTag estado={c.estado} />
                </td>
                <td>
                  {c.estado === 'Nueva' ? (
                    <button className="b b-green b-sm" onClick={() => atender(c.id)}>
                      Marcar atendida
                    </button>
                  ) : (
                    <Tag tone="t-green">✓</Tag>
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
