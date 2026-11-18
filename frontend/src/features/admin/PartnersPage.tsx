/* Administración › Clientes y proveedores: activar o desactivar. Los datos se siguen editando en
   SIVEN (Clientes, Proveedores); aquí solo se decide quién se puede usar en documentos nuevos. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { errorMessage } from '../../services/api/client';
import { adminApi, type SocioAdmin, type TipoSocio } from './adminApi';
import { AdminHead, Confirmar, Vacio } from './ui';

const TEXTO: Record<TipoSocio, { varios: string; uno: string; efecto: string }> = {
  customers: { varios: 'Clientes', uno: 'cliente', efecto: 'No se podrá elegir para cotizaciones, ventas ni órdenes de servicio nuevas. Sus facturas, pagos y saldo se conservan.' },
  suppliers: { varios: 'Proveedores', uno: 'proveedor', efecto: 'No se podrá elegir para compras nuevas. Sus compras anteriores se conservan.' },
};

export function PartnersPage() {
  const [tipo, setTipo] = useState<TipoSocio>('customers');
  return (
    <>
      <AdminHead titulo="Clientes y proveedores" desc="Active o desactive clientes y proveedores. Sus datos se editan en SIVEN; nada se borra." />
      <div className="adm-seg" role="tablist" aria-label="Tipo">
        {(['customers', 'suppliers'] as TipoSocio[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tipo === t} className={tipo === t ? 'is-on' : ''} onClick={() => setTipo(t)}>
            {TEXTO[t].varios}
          </button>
        ))}
      </div>
      <Lista key={tipo} tipo={tipo} />
    </>
  );
}

function Lista({ tipo }: { tipo: TipoSocio }) {
  const modal = useModal();
  const toast = useToast();
  const t = TEXTO[tipo];
  const [lista, setLista] = useState<SocioAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const cargar = useCallback(() => {
    adminApi
      .socios(tipo)
      .then(setLista)
      .catch((e) => setError(errorMessage(e)));
  }, [tipo]);
  useEffect(cargar, [cargar]);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (lista ?? [])
      .filter((x) => !s || `${x.name} ${x.ruc ?? ''} ${x.taxId ?? ''} ${x.contactName ?? ''} ${x.email ?? ''}`.toLowerCase().includes(s))
      .filter((x) => !estado || (estado === 'activos') === x.isActive)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [lista, q, estado]);
  const inactivos = (lista ?? []).filter((x) => !x.isActive).length;

  const cambiar = (x: SocioAdmin) =>
    modal.open(
      <Confirmar
        titulo={`${x.isActive ? 'Desactivar' : 'Activar'} ${t.uno}`}
        boton={x.isActive ? 'Desactivar' : 'Activar'}
        peligro={x.isActive}
        onConfirmar={async () => {
          await adminApi.estadoSocio(tipo, x.id, !x.isActive);
          toast(`${x.name} ${x.isActive ? 'desactivado' : 'activado'}`, 'ok');
          cargar();
        }}
      >
        <p>
          <b>{x.name}</b>
        </p>
        <p>{x.isActive ? t.efecto : `Volverá a estar disponible para documentos nuevos.`}</p>
      </Confirmar>,
    );

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Buscar</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${t.uno} por nombre, RUC, contacto o correo…`} />
        </label>
        <select className="toolbar-select" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Activos e inactivos ({inactivos} inactivo{inactivos === 1 ? '' : 's'})</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{tipo === 'customers' ? 'Cliente' : 'Proveedor'}</th>
              <th>{tipo === 'customers' ? 'RUC' : 'RUC / país'}</th>
              <th>Contacto</th>
              <th>Teléfono / correo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!lista && !error && <Vacio cols={6} msg="Cargando…" />}
            {lista && !filtrados.length && <Vacio cols={6} msg="Nada coincide con la búsqueda" />}
            {filtrados.map((x) => (
              <tr key={x.id} className={x.isActive ? '' : 'adm-off'}>
                <td>
                  <b>{x.name}</b>
                </td>
                <td className="mono">
                  {tipo === 'customers' ? x.ruc || '—' : x.taxId || '—'}
                  {tipo === 'suppliers' && x.country && <div className="sub-num">{x.country}</div>}
                </td>
                <td>{x.contactName || '—'}</td>
                <td>
                  {x.phone || '—'}
                  {x.email && <div className="sub-num">{x.email}</div>}
                </td>
                <td>{x.isActive ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>}</td>
                <td>
                  <button type="button" className={`b b-sm ${x.isActive ? 'b-red' : 'b-green'}`} onClick={() => cambiar(x)}>
                    {x.isActive ? 'Desactivar' : 'Activar'}
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
