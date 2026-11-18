/* MÓDULO: PROVEEDORES (RF-04) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import { matches } from '../../utils/format';
import { SupplierFormModal } from './SupplierFormModal';

export function SuppliersPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('suppliers:write');
  const modal = useModal();
  const [q, setQ] = useState('');
  const rows = db.proveedores.filter((p) => matches(q, p.nombre, p.ruc, p.pais, p.contacto, p.tel, p.correo));

  return (
    <>
      <ViewHead
        title="Proveedores"
        desc="Proveedores nacionales e internacionales."
        actions={
          canWrite && (
            <button className="b b-amber" onClick={() => modal.open(<SupplierFormModal />)}>
              + Nuevo proveedor
            </button>
          )
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar proveedor…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>RUC</th>
              <th>País</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.proveedores.length && <EmptyRow cols={7} msg="Sin proveedores" />}
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.nombre}</b>
                </td>
                <td className="mono">{p.ruc}</td>
                <td>
                  <Tag tone={p.internacional ? 't-blue' : 't-gray'}>{p.pais || '—'}</Tag>
                </td>
                <td>{p.contacto}</td>
                <td className="mono">{p.tel}</td>
                <td>{p.correo}</td>
                <td>
                  {canWrite && (
                    <button className="b b-out b-sm" onClick={() => modal.open(<SupplierFormModal proveedor={p} />)}>
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
