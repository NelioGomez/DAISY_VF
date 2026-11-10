/* Administración › Categorías y marcas: crear, renombrar, activar o desactivar y eliminar las que no
   tienen productos. Una categoría o marca inactiva saca sus productos del sitio público. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { errorMessage } from '../../services/api/client';
import { adminApi, type CatalogoAdmin, type TipoCatalogo } from './adminApi';
import { AdminHead, Confirmar, Vacio } from './ui';

const TEXTO: Record<TipoCatalogo, { uno: string; varios: string; nueva: string; la: string }> = {
  categories: { uno: 'categoría', varios: 'Categorías', nueva: 'Nueva categoría', la: 'la categoría' },
  brands: { uno: 'marca', varios: 'Marcas', nueva: 'Nueva marca', la: 'la marca' },
};

export function CatalogsPage() {
  const [tipo, setTipo] = useState<TipoCatalogo>('categories');
  return (
    <>
      <AdminHead titulo="Categorías y marcas" desc="Ordenan el catálogo de productos y los filtros del sitio público." />
      <div className="adm-seg" role="tablist" aria-label="Catálogo">
        {(['categories', 'brands'] as TipoCatalogo[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tipo === t} className={tipo === t ? 'is-on' : ''} onClick={() => setTipo(t)}>
            {TEXTO[t].varios}
          </button>
        ))}
      </div>
      <Catalogo key={tipo} tipo={tipo} />
    </>
  );
}

function Catalogo({ tipo }: { tipo: TipoCatalogo }) {
  const modal = useModal();
  const toast = useToast();
  const t = TEXTO[tipo];
  const [lista, setLista] = useState<CatalogoAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const cargar = useCallback(() => {
    adminApi
      .catalogo(tipo)
      .then(setLista)
      .catch((e) => setError(errorMessage(e)));
  }, [tipo]);
  useEffect(cargar, [cargar]);
  const listo = (msg: string) => {
    toast(msg, 'ok');
    cargar();
  };
  const filtrados = useMemo(
    () =>
      (lista ?? [])
        .filter((c) => !q.trim() || `${c.name} ${c.description ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    [lista, q],
  );
  const cols = tipo === 'categories' ? 5 : 4;

  const estado = (c: CatalogoAdmin) =>
    modal.open(
      <Confirmar
        titulo={`${c.isActive ? 'Desactivar' : 'Activar'} ${t.la} «${c.name}»`}
        boton={c.isActive ? 'Desactivar' : 'Activar'}
        peligro={c.isActive}
        onConfirmar={async () => {
          await adminApi.estadoCatalogo(tipo, c.id, !c.isActive);
          listo(`${c.name} ${c.isActive ? 'desactivada' : 'activada'}`);
        }}
      >
        <p>
          {c.isActive
            ? `Sus ${c.productCount} producto(s) dejarán de verse en el sitio público y no se podrá elegir para productos nuevos. En SIVEN los productos siguen existiendo con su historial.`
            : `Sus ${c.productCount} producto(s) activos y con precio volverán a verse en el sitio público.`}
        </p>
      </Confirmar>,
    );

  const eliminar = (c: CatalogoAdmin) =>
    modal.open(
      <Confirmar
        titulo={`Eliminar ${t.la} «${c.name}»`}
        boton="Eliminar"
        peligro
        onConfirmar={async () => {
          await adminApi.eliminarCatalogo(tipo, c.id);
          listo(`${c.name} eliminada`);
        }}
      >
        <p>No tiene productos, así que se puede eliminar. Esta acción no se puede deshacer.</p>
      </Confirmar>,
    );

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Buscar</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${t.uno}…`} />
        </label>
        <button type="button" className="b b-amber" onClick={() => modal.open(<CatalogoForm tipo={tipo} onListo={listo} />)}>
          + {t.nueva}
        </button>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              {tipo === 'categories' && <th>Descripción</th>}
              <th className="num">Productos</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!lista && !error && <Vacio cols={cols} msg="Cargando…" />}
            {lista && !filtrados.length && <Vacio cols={cols} msg="Nada coincide con la búsqueda" />}
            {filtrados.map((c) => (
              <tr key={c.id} className={c.isActive ? '' : 'adm-off'}>
                <td>
                  <b>{c.name}</b>
                </td>
                {tipo === 'categories' && <td className="muted-sm">{c.description || '—'}</td>}
                <td className="num mono">{c.productCount}</td>
                <td>{c.isActive ? <Tag tone="t-green">Activa</Tag> : <Tag>Inactiva</Tag>}</td>
                <td>
                  <span className="row-actions">
                    <button type="button" className="b b-out b-sm" onClick={() => modal.open(<CatalogoForm tipo={tipo} item={c} onListo={listo} />)}>
                      Editar
                    </button>
                    <button type="button" className={`b b-sm ${c.isActive ? 'b-red' : 'b-green'}`} onClick={() => estado(c)}>
                      {c.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    {c.productCount === 0 && (
                      <button type="button" className="b b-out b-sm" onClick={() => eliminar(c)}>
                        Eliminar
                      </button>
                    )}
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

function CatalogoForm({ tipo, item, onListo }: { tipo: TipoCatalogo; item?: CatalogoAdmin; onListo: (msg: string) => void }) {
  const { close } = useModal();
  const toast = useToast();
  const t = TEXTO[tipo];
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    setSaving(true);
    try {
      const d = tipo === 'categories' ? { name: name.trim(), description: description.trim() } : { name: name.trim() };
      if (item) await adminApi.editarCatalogo(tipo, item.id, d);
      else await adminApi.crearCatalogo(tipo, d);
      close();
      onListo(`${name.trim()} ${item ? 'actualizada' : 'creada'}`);
    } catch (e) {
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={item ? `Editar ${t.uno}` : t.nueva}
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="b b-amber" onClick={guardar} disabled={!name.trim() || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <Field label="Nombre" htmlFor="cat-nombre" help={tipo === 'categories' ? 'Ej.: Boquillas y accesorios' : 'Ej.: GILBARCO'}>
        <input id="cat-nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
      </Field>
      {tipo === 'categories' && (
        <Field label="Descripción (opcional)" htmlFor="cat-desc">
          <textarea id="cat-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
        </Field>
      )}
    </Modal>
  );
}
