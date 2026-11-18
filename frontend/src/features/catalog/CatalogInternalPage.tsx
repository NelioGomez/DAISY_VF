/* MÓDULO: CATÁLOGO WEB — vista interna (RF-16; mejora n.° 61)
   Muestra cada producto como lo ve el cliente y si de verdad aparece en el sitio público: el sitio
   solo publica productos activos, con precio y con su categoría y marca activas (misma regla que
   PublicCatalogService). Señala lo que le falta a la ficha (foto, descripción) y lleva a
   corregirlo. Tarjetas de resumen que filtran, búsqueda, filtros, vista en tarjetas o en lista y
   paginación para catálogos grandes. */
import { useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/common/Icon';
import { ProductImage } from '../../components/common/ProductImage';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyState } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag, type TagTone } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Catalogo, Disponibilidad, Producto } from '../../types';
import { money } from '../../utils/format';
import { plazoGarantia } from '../../utils/warranty';
import { PriceModal } from '../products/PriceModal';
import { ProductFormModal } from '../products/ProductFormModal';
import { useRecords } from '../records/records';

type Motivo = 'inactivo' | 'sin-precio' | 'categoria' | 'marca';
const MOTIVO: Record<Motivo, string> = {
  inactivo: 'Producto inactivo',
  'sin-precio': 'Sin precio de venta',
  categoria: 'Su categoría está inactiva',
  marca: 'Su marca está inactiva',
};

const DISPONIBILIDAD: Record<Disponibilidad, TagTone> = { Disponible: 't-green', 'Pocas unidades': 't-amber', 'Bajo pedido': 't-gray' };

interface Fila {
  p: Producto;
  publicado: boolean;
  motivos: Motivo[];
  disponibilidad: Disponibilidad;
  sinFoto: boolean;
  sinDescripcion: boolean;
}

/** Misma regla que el sitio público (visible + availabilityOf del backend). */
function evaluar(p: Producto, categorias: Map<string, Catalogo>, marcas: Map<string, Catalogo>): Fila {
  const motivos: Motivo[] = [];
  if (!p.activo) motivos.push('inactivo');
  if (!(p.precio > 0)) motivos.push('sin-precio');
  if (p.categoriaId && categorias.get(p.categoriaId)?.activo === false) motivos.push('categoria');
  if (p.marcaId && marcas.get(p.marcaId)?.activo === false) motivos.push('marca');
  const desc = p.descripcion.trim();
  return {
    p,
    publicado: motivos.length === 0,
    motivos,
    disponibilidad: p.stock <= 0 ? 'Bajo pedido' : p.stock <= p.stockMin ? 'Pocas unidades' : 'Disponible',
    sinFoto: !p.imagen.trim(),
    sinDescripcion: !desc || desc === p.nombre.trim(),
  };
}

const VISTA_KEY = 'siven.catalogo.vista';
type Vista = 'tarjetas' | 'lista';
function leerVista(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === 'lista' ? 'lista' : 'tarjetas';
  } catch {
    return 'tarjetas';
  }
}

export function CatalogInternalPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canEdit = can('products:write');
  const canPrice = can('prices:write');
  const modal = useModal();
  const { openRecord } = useRecords();
  const [vista, setVista] = useState<Vista>(leerVista);
  const cambiarVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      /* sin almacenamiento: la vista vuelve a tarjetas al recargar */
    }
  };

  const filas = useMemo(() => {
    const cats = new Map(db.categorias.map((c) => [c.id, c]));
    const marcas = new Map(db.marcas.map((m) => [m.id, m]));
    // Primero lo que el cliente ve; luego los activos sin publicar y al final los inactivos.
    const rango = (x: Fila) => (x.publicado ? 0 : x.p.activo ? 1 : 2);
    return db.productos
      .map((p) => evaluar(p, cats, marcas))
      .sort((a, b) => rango(a) - rango(b) || a.p.nombre.localeCompare(b.p.nombre, 'es'));
  }, [db.productos, db.categorias, db.marcas]);

  const activos = filas.filter((f) => f.p.activo);
  const categorias = [...new Set(filas.map((f) => f.p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const marcas = [...new Set(filas.map((f) => f.p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const selects: SelectFilter<Fila>[] = [
    {
      key: 'publicacion',
      label: 'Publicación',
      options: [
        { value: 'si', label: 'Publicados en el sitio' },
        { value: 'no', label: 'Activos sin publicar' },
        { value: 'inactivo', label: 'Inactivos' },
      ],
      test: (f, v) => (v === 'si' ? f.publicado : v === 'no' ? f.p.activo && !f.publicado : !f.p.activo),
    },
    { key: 'categoria', label: 'Categoría', options: categorias.map((c) => ({ value: c, label: c })), test: (f, v) => f.p.categoria === v },
    ...(marcas.length > 1 ? [{ key: 'marca', label: 'Marca', options: marcas.map((m) => ({ value: m, label: m })), test: (f: Fila, v: string) => f.p.marca === v }] : []),
    {
      key: 'disponibilidad',
      label: 'Disponibilidad',
      options: (Object.keys(DISPONIBILIDAD) as Disponibilidad[]).map((d) => ({ value: d, label: d })),
      test: (f, v) => f.disponibilidad === v,
    },
    {
      key: 'ficha',
      label: 'Ficha',
      options: [
        { value: 'sin-foto', label: 'Sin foto' },
        { value: 'sin-descripcion', label: 'Sin descripción' },
        { value: 'sin-garantia', label: 'Sin garantía registrada' },
        { value: 'completa', label: 'Con foto y descripción' },
      ],
      test: (f, v) => (v === 'sin-foto' ? f.sinFoto : v === 'sin-descripcion' ? f.sinDescripcion : v === 'sin-garantia' ? !f.p.garantiaDias : !f.sinFoto && !f.sinDescripcion),
    },
  ];
  const f = useListFilters(filas, { search: (x) => [x.p.nombre, x.p.sku, x.p.marca, x.p.categoria, x.p.codigoBarras], selects });
  const pg = usePaged(f.filtered, f.key, 'catalogo-web');

  const tarjetas: Array<{ id: string; ic: IconName; label: string; n: number; sub: string; filtro: [string, string]; warn?: boolean }> = [
    { id: 'si', ic: 'globe', label: 'Publicados', n: activos.filter((x) => x.publicado).length, sub: `de ${activos.length} productos activos`, filtro: ['publicacion', 'si'] },
    {
      id: 'no',
      ic: 'eye-off',
      label: 'Sin publicar',
      n: activos.filter((x) => !x.publicado).length,
      sub: 'activos que el cliente no ve',
      filtro: ['publicacion', 'no'],
      warn: activos.some((x) => !x.publicado),
    },
    { id: 'foto', ic: 'image-off', label: 'Sin foto', n: activos.filter((x) => x.sinFoto).length, sub: 'se muestra el ícono de la categoría', filtro: ['ficha', 'sin-foto'] },
    { id: 'desc', ic: 'file-text', label: 'Sin descripción', n: activos.filter((x) => x.sinDescripcion).length, sub: 'la ficha pública queda sin detalle', filtro: ['ficha', 'sin-descripcion'] },
  ];
  const activa = (t: (typeof tarjetas)[number]) => f.values[t.filtro[0]] === t.filtro[1];
  const toggle = (t: (typeof tarjetas)[number]) => f.setValue(t.filtro[0], activa(t) ? '' : t.filtro[1]);

  const acciones = (x: Fila) => (
    <>
      <button type="button" className="b b-out b-sm" onClick={() => openRecord('producto', x.p.id)}>
        Ficha
      </button>
      {x.publicado ? (
        <a className="b b-out b-sm" href={`/catalogo/${x.p.id}`} target="_blank" rel="noreferrer" title="Abre la ficha pública en otra pestaña">
          <Icon name="external-link" size={13} /> Sitio
        </a>
      ) : (
        x.p.activo &&
        x.motivos.includes('sin-precio') &&
        canPrice && (
          <button type="button" className="b b-amber b-sm" onClick={() => modal.open(<PriceModal producto={x.p} />)}>
            Fijar precio
          </button>
        )
      )}
      {x.p.activo && canEdit && (x.sinFoto || x.sinDescripcion) && (
        <button type="button" className="b b-out b-sm" onClick={() => modal.open(<ProductFormModal producto={x.p} />)}>
          Completar
        </button>
      )}
    </>
  );

  const pendientes = (x: Fila) => [
    ...x.motivos.map((m) => ({ key: m, txt: MOTIVO[m], grave: true })),
    ...(x.sinFoto ? [{ key: 'foto', txt: 'Sin foto', grave: false }] : []),
    ...(x.sinDescripcion ? [{ key: 'desc', txt: 'Sin descripción', grave: false }] : []),
  ];

  return (
    <>
      <ViewHead
        title="Catálogo Web"
        desc="Así ven sus productos los clientes en el sitio público, y qué le falta a cada uno para publicarse o verse completo."
        actions={
          <a className="b b-amber" href="/catalogo" target="_blank" rel="noreferrer">
            <Icon name="globe" size={16} /> Abrir sitio público
          </a>
        }
      />

      <div className="stat-cards" role="group" aria-label="Resumen del catálogo">
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className={`stat-card ${activa(t) ? 'is-on' : ''} ${t.warn ? 'is-warn' : ''}`} aria-pressed={activa(t)} onClick={() => toggle(t)}>
            <span>
              <Icon name={t.ic} size={14} /> {t.label}
            </span>
            <b>{t.n}</b>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>

      <FilterBar f={f} placeholder="Buscar por nombre, SKU, marca, categoría o código de barras…">
        <div className="seg" role="group" aria-label="Vista">
          <button className={vista === 'tarjetas' ? 'on' : ''} aria-pressed={vista === 'tarjetas'} onClick={() => cambiarVista('tarjetas')} title="Como en el sitio">
            <Icon name="layout-grid" size={15} label="Tarjetas" />
          </button>
          <button className={vista === 'lista' ? 'on' : ''} aria-pressed={vista === 'lista'} onClick={() => cambiarVista('lista')} title="Lista de revisión">
            <Icon name="list" size={15} label="Lista" />
          </button>
        </div>
      </FilterBar>

      {!filas.length ? (
        <div className="card">
          <EmptyState msg="Todavía no hay productos registrados" ic="📦" />
        </div>
      ) : !f.filtered.length ? (
        <div className="card">
          <EmptyState msg="Ningún producto coincide con los filtros" ic="🔍" />
        </div>
      ) : vista === 'tarjetas' ? (
        <div className="cat-grid">
          {pg.pageRows.map((x) => (
            <article key={x.p.id} className={`prod-card ${x.publicado ? '' : 'is-hidden'}`}>
              <div className="img">
                {x.p.imagen ? <ProductImage src={x.p.imagen} size={120} fallback={x.p.ic} alt={x.p.nombre} className="prod-card-photo" /> : <span aria-hidden="true">{x.p.ic}</span>}
                <span className="cat">{x.p.categoria || 'Sin categoría'}</span>
                <span className={`pub-flag ${x.publicado ? 'is-on' : 'is-off'}`}>
                  <Icon name={x.publicado ? 'globe' : 'eye-off'} size={12} strokeWidth={2.4} /> {x.publicado ? 'Publicado' : 'No publicado'}
                </span>
              </div>
              <div className="bd">
                <b>{x.p.nombre}</b>
                <div className="mk">
                  {x.p.marca || 'Sin marca'} · <span className="mono">{x.p.sku}</span>
                </div>
                <div className="pr">{x.p.precio > 0 ? money(x.p.precio) : <span className="pr-none">Sin precio</span>}</div>
                <div className="av">
                  <Tag tone={DISPONIBILIDAD[x.disponibilidad]}>{x.disponibilidad}</Tag>
                  {x.p.garantiaDias ? (
                    <Tag tone="t-blue">
                      <Icon name="shield-check" size={12} strokeWidth={2.4} /> {plazoGarantia(x.p.garantiaDias)}
                    </Tag>
                  ) : null}
                </div>
                {pendientes(x).length > 0 && (
                  <ul className="cat-issues" aria-label="Pendientes">
                    {pendientes(x).map((i) => (
                      <li key={i.key} className={i.grave ? 'is-grave' : ''}>
                        <Icon name={i.grave ? 'eye-off' : 'triangle-alert'} size={12} /> {i.txt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="prod-card-actions">{acciones(x)}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Precio</th>
                <th>Disponibilidad</th>
                <th>En el sitio</th>
                <th>Pendiente</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageRows.map((x) => (
                <tr key={x.p.id} className={x.p.activo ? '' : 'row-muted'}>
                  <td>
                    <div className="prod-cell">
                      <ProductImage src={x.p.imagen} size={36} fallback={x.p.ic} alt="" />
                      <div>
                        <button type="button" className="link-btn" onClick={() => openRecord('producto', x.p.id)}>
                          {x.p.nombre}
                        </button>
                        <div className="sub-num">
                          {x.p.marca || 'Sin marca'} · <span className="mono">{x.p.sku}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{x.p.categoria || <span className="muted-sm">Sin categoría</span>}</td>
                  <td className="num">{x.p.precio > 0 ? money(x.p.precio) : <span className="muted-sm">—</span>}</td>
                  <td>
                    <Tag tone={DISPONIBILIDAD[x.disponibilidad]}>{x.disponibilidad}</Tag>
                  </td>
                  <td>
                    {x.publicado ? (
                      <Tag tone="t-green">
                        <Icon name="globe" size={12} strokeWidth={2.4} /> Publicado
                      </Tag>
                    ) : (
                      <Tag tone={x.p.activo ? 't-red' : 't-gray'}>
                        <Icon name="eye-off" size={12} strokeWidth={2.4} /> No publicado
                      </Tag>
                    )}
                  </td>
                  <td className="muted-sm">{pendientes(x).map((i) => i.txt).join(' · ') || '—'}</td>
                  <td className="row-actions">{acciones(x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination p={pg} label="productos" />
    </>
  );
}
