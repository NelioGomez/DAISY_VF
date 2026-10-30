import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Página no encontrada');
  return (
    <div className="pub-page">
      <div className="pub-empty is-page">
        <h1>No encontramos esta página</h1>
        <p>Puede que el enlace esté incompleto o que la página se haya movido.</p>
        <div className="pub-two">
          <Link to="/" className="pub-btn pub-btn-amber">
            Ir al inicio
          </Link>
          <Link to="/catalogo" className="pub-btn pub-btn-line">
            Ver productos
          </Link>
        </div>
      </div>
    </div>
  );
}
