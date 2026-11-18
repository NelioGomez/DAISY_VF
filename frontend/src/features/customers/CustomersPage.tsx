/* MÓDULO: CLIENTES (RF-05) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { useData } from '../../store/hooks';
import { matches, money } from '../../utils/format';
import { CustomerFormModal } from './CustomerFormModal';

export function CustomersPage() {
  const { db } = useData();
  const modal = useModal();
  const [q, setQ] = useState('');
  const comprasDe = (id: string) => db.ventas.filter((v) => v.cli === id).reduce((a, v) => a + v.total, 0);
  const rows = db.clientes.filter((c) => matches(q, c.nombre, c.ruc, c.contacto, c.tel, c.dir, money(comprasDe(c.id))));

  return (
    <>
      <ViewHead
        title="Clientes"
        desc="Cartera comercial con RUC, contacto e historial."
        actions={
          <button className="b b-amber" onClick={() => modal.open(<CustomerFormModal />)}>
            + Nuevo cliente
          </button>
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
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.clientes.length && <EmptyRow cols={7} msg="Sin clientes" />}
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.nombre}</b>
                </td>
                <td className="mono">{c.ruc}</td>
                <td>{c.contacto}</td>
                <td className="mono">{c.tel}</td>
                <td>{c.dir}</td>
                <td className="num">{money(comprasDe(c.id))}</td>
                <td>
                  <button className="b b-out b-sm" onClick={() => modal.open(<CustomerFormModal cliente={c} />)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
