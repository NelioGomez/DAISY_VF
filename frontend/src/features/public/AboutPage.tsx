/* Nosotros. La misión, la visión y los valores NO están formalizados por la empresa
   (diagnóstico del proyecto): se muestran marcados como propuesta hasta su aprobación. */
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePublicInfo } from './usePublicInfo';

export function AboutPage() {
  usePageTitle('Nosotros');
  const { info } = usePublicInfo();

  return (
    <div className="pub-page">
      <header className="pub-page-head">
        <h1>Nosotros</h1>
        <p className="pub-lead">
          NORCOR Fueling System abastece a estaciones de servicio con repuestos, equipos y servicio técnico, para que los surtidores sigan despachando sin
          interrupciones.
        </p>
      </header>

      <section className="pub-about-grid" aria-label="Qué hacemos">
        <div>
          <h2>Repuestos y equipos</h2>
          <p>Boquillas, mangueras, filtros, dispensadores, bombas, sellos y componentes eléctricos para la operación diaria de la estación.</p>
        </div>
        <div>
          <h2>Servicio técnico</h2>
          <p>Instalación y mantenimiento de equipos mediante órdenes de servicio, con seguimiento de cada trabajo hasta su entrega.</p>
        </div>
        <div>
          <h2>Atención a empresas</h2>
          <p>Cotizaciones formales, seguimiento de solicitudes en línea y condiciones de pago para clientes registrados.</p>
        </div>
      </section>

      <section className="pub-proposal" aria-labelledby="mvv-title">
        <div className="pub-proposal-flag" role="note">
          <strong>Texto en propuesta.</strong> La misión, la visión y los valores aún no han sido aprobados por NORCOR como declaración oficial.
        </div>
        <h2 id="mvv-title">Misión, visión y valores</h2>
        <div className="pub-mvv">
          <div>
            <h3>Misión</h3>
            <p>Mantener operando las estaciones de servicio de nuestros clientes con repuestos confiables, asesoría técnica y respuesta oportuna.</p>
          </div>
          <div>
            <h3>Visión</h3>
            <p>Ser el proveedor de referencia en repuestos y servicio para estaciones de servicio en Nicaragua.</p>
          </div>
          <div>
            <h3>Valores</h3>
            <ul>
              <li>Responsabilidad con cada pedido</li>
              <li>Honestidad en precios y plazos</li>
              <li>Seguridad en cada instalación</li>
              <li>Servicio cercano al cliente</li>
            </ul>
          </div>
        </div>
      </section>

      {info && info.marcas.length > 0 && (
        <section className="pub-brands is-inline" aria-labelledby="about-brands">
          <h2 id="about-brands">Marcas que distribuimos</h2>
          <ul>
            {info.marcas.map((m) => (
              <li key={m.id}>
                <Link to={`/catalogo?marca=${m.id}`}>{m.nombre}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pub-page-cta">
        <Link to="/catalogo" className="pub-btn pub-btn-amber">
          Ver productos
        </Link>
        <Link to="/contacto" className="pub-btn pub-btn-line">
          Contactar a NORCOR
        </Link>
      </div>
    </div>
  );
}
