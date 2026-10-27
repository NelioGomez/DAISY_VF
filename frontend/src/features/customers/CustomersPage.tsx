/* MÓDULO: CLIENTES (RF-05) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { useAuth, useData } from '../../store/hooks';
import { matches, money } from '../../utils/format';
import { CustomerFormModal } from './CustomerFormModal';

export function CustomersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('customers:write');
  const modal = useModal();
  const [q, setQ] = useState('');
  const rows = db.clientes.filter((c) => matches(q, c.nombre, c.ruc, c.contacto, c.tel, c.dir, money(c.totalCompras)));

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
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar cliente…" />
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
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.nombre}</b>
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
    </>
  );
}
