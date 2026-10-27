/* CATÁLOGO PÚBLICO (cliente web — RF-16/17)
   Usa los endpoints públicos de la API (sin sesión): /public/products y
   /public/categories. No expone costos, proveedores ni stock exacto. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { EmptyState } from '../../components/feedback/Empty';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { WHATSAPP_URL } from '../../config/business';
import { api, errorMessage, getAll } from '../../services/api/client';
import { iconFor } from '../../services/api/mappers';
import { useAuth } from '../../store/hooks';
import { ProductCard, type CatalogItem, type Disponibilidad } from './ProductCard';
import { PublicInquiryModal } from './PublicInquiryModal';

const AVAILABILITY: Record<string, Disponibilidad> = { AVAILABLE: 'Disponible', LIMITED: 'Pocas unidades', OUT_OF_STOCK: 'Bajo pedido' };

/* eslint-disable @typescript-eslint/no-explicit-any */
const toItem = (p: any): CatalogItem => ({
  id: p.id,
  nombre: p.name,
  marca: p.brand?.name ?? '',
  sku: p.sku,
  categoria: p.category?.name ?? '',
  precio: Number(p.price ?? 0),
  ic: iconFor(p.category?.name),
  disponibilidad: AVAILABILITY[p.availability] ?? 'Disponible',
});

export function PublicCatalogPage() {
  const { user } = useAuth();
  const modal = useModal();
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');

  useEffect(() => {
    let alive = true;
    Promise.all([getAll<any>('/public/products', { limit: 50 }, 10, false), api.get<any[]>('/public/categories', undefined, false)])
      .then(([prods, cats]) => {
        if (!alive) return;
        setItems(prods.items.map(toItem));
        setCategorias((cats ?? []).map((c) => c.name));
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, []);

  const query = q.toLowerCase();
  const visibles = (items ?? []).filter((p) => (cat === 'Todos' || p.categoria === cat) && `${p.nombre} ${p.marca} ${p.sku}`.toLowerCase().includes(query));

  return (
    <section id="catalog">
      <div className="cat-hero">
        <div className="bar">
          <Logo />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <a className="b b-out" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              💬 WhatsApp
            </a>
            <button className="b b-amber" onClick={() => navigate(user ? '/app' : '/login')}>
              {user ? 'Volver al sistema' : 'Acceso interno'}
            </button>
          </div>
        </div>
        <h1>Repuestos y equipamiento para estaciones de servicio</h1>
        <p>Boquillas, mangueras, filtros, dispensadores, bombas y componentes eléctricos. Consulte disponibilidad y solicite su cotización en línea.</p>
      </div>

      <div className="cat-wrap">
        <SearchToolbar value={q} onChange={setQ} placeholder="Buscar producto…" searchStyle={{ maxWidth: 340 }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9 }}>
            {['Todos', ...categorias].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="b b-amber" style={{ marginLeft: 'auto' }} onClick={() => modal.open(<PublicInquiryModal />)}>
            ✉ Solicitar cotización
          </button>
        </SearchToolbar>
        {error ? (
          <div className="card conn-error" role="alert">
            <h2>El catálogo no está disponible</h2>
            <p>{error}</p>
          </div>
        ) : items === null ? (
          <ViewLoader text="Cargando catálogo…" />
        ) : visibles.length ? (
          <div className="cat-grid">
            {visibles.map((p) => (
              <ProductCard key={p.id} item={p} variant="public" onRequest={(x) => modal.open(<PublicInquiryModal producto={x.nombre} />)} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 18 }}>
            <EmptyState msg="No hay productos que coincidan con la búsqueda" ic="🔍" />
          </div>
        )}
      </div>
    </section>
  );
}
