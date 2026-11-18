/* CATÁLOGO PÚBLICO (cliente web — RF-16/17) */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { CATEGORIAS, WHATSAPP_URL } from '../../config/business';
import { useAuth, useData } from '../../store/hooks';
import { ProductCard } from './ProductCard';
import { PublicInquiryModal } from './PublicInquiryModal';

const FILTROS = ['Todos', ...CATEGORIAS];

export function PublicCatalogPage() {
  const { db } = useData();
  const { user } = useAuth();
  const modal = useModal();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');

  const query = q.toLowerCase();
  const productos = db.productos
    .filter((p) => p.activo)
    .filter((p) => (cat === 'Todos' || p.categoria === cat) && `${p.nombre} ${p.marca} ${p.sku}`.toLowerCase().includes(query));

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
              Acceso interno →
            </button>
          </div>
        </div>
        <h1>Repuestos y equipamiento para estaciones de servicio</h1>
        <p>Boquillas, mangueras, filtros, dispensadores, bombas y componentes eléctricos. Consulte disponibilidad y solicite su cotización en línea.</p>
      </div>

      <div className="cat-wrap">
        <SearchToolbar value={q} onChange={setQ} placeholder="Buscar producto…" searchStyle={{ maxWidth: 340 }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9 }}>
            {FILTROS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="b b-amber" style={{ marginLeft: 'auto' }} onClick={() => modal.open(<PublicInquiryModal />)}>
            ✉ Solicitar cotización
          </button>
        </SearchToolbar>
        <div className="cat-grid">
          {productos.map((p) => (
            <ProductCard key={p.id} producto={p} variant="public" onRequest={(x) => modal.open(<PublicInquiryModal producto={x.nombre} />)} />
          ))}
        </div>
      </div>
    </section>
  );
}
