/* =====================================================================
   Cada parte del sistema en su dominio.
   - Sitio público y portal de clientes → norcor-catalogo.vercel.app
   - Sistema interno y panel de administración → siven.vercel.app
   vercel.json ya redirige cuando la página se carga desde el servidor, pero
   los enlaces de React Router cambian de pantalla sin pedir nada al servidor:
   esta guarda hace la misma redirección en el navegador.
   Solo actúa si la página está abierta en uno de los dos dominios; en
   desarrollo (localhost) y en las vistas previas de Vercel no hace nada.
   ===================================================================== */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const limpiar = (url: string) => url.trim().replace(/\/+$/, '');

/** Dominio del sitio público y del portal de clientes. */
const SITE_URL = limpiar(import.meta.env.VITE_SITE_URL || 'https://norcor-catalogo.vercel.app');
/** Dominio del sistema interno (SIVEN) y del panel de administración. */
const SYSTEM_URL = limpiar(import.meta.env.VITE_SYSTEM_URL || 'https://siven.vercel.app');

const RUTAS_INTERNAS = /^\/(login|recuperar|app|admin)(\/|$)/;

/** Dirección completa a la que hay que ir, o null si la ruta ya está en su dominio (o no aplica). */
function destinoDe(origen: string, ruta: string, resto = ''): string | null {
  if (!SITE_URL || !SYSTEM_URL || SITE_URL === SYSTEM_URL) return null;
  const interna = RUTAS_INTERNAS.test(ruta);
  if (origen === SITE_URL && interna) return SYSTEM_URL + ruta + resto;
  // En el dominio del sistema, la raíz es el sistema (igual que en vercel.json).
  if (origen === SYSTEM_URL && ruta === '/') return SYSTEM_URL + '/app';
  if (origen === SYSTEM_URL && !interna) return SITE_URL + ruta + resto;
  return null;
}

export function DomainGuard() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    const destino = destinoDe(window.location.origin, pathname, search + hash);
    if (destino) window.location.replace(destino);
  }, [pathname, search, hash]);
  return null;
}
