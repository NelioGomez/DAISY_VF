/* Sesión del portal de clientes y lista de solicitud de cotización.
   - La sesión del cliente es independiente de la del personal (otra clave, otro token).
   - La lista vive en localStorage: sobrevive a iniciar sesión o crear cuenta en medio del
     flujo (sección 6.2 del análisis: "regresar a la solicitud conservando los productos"). */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as portal from '../../services/portal/portalService';
import type { CuentaCliente, LineaLista, ProductoPublico } from '../../types';
import { CustomerContext, QuoteListContext, type CustomerValue, type MotivoSalida, type QuoteListValue } from './customerContext';

const SESSION_KEY = 'siven.cliente';
const LIST_KEY = 'siven.lista';

interface Stored {
  token: string;
  expiresAt: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: dura solo esta visita */
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(() => {
    const s = read<Stored>(SESSION_KEY);
    return s && s.expiresAt > Date.now() + 5_000 ? s : null;
  });
  const [token, setToken] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<CuentaCliente | null>(null);
  const [restaurando, setRestaurando] = useState(stored !== null);
  const [salida, setSalida] = useState<MotivoSalida | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const salir = useCallback((motivo: MotivoSalida = 'manual') => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    write(SESSION_KEY, null);
    setToken(null);
    setCuenta(null);
    setSalida(motivo);
  }, []);

  const aplicarSesion = useCallback(
    (s: portal.PortalSession) => {
      write(SESSION_KEY, { token: s.token, expiresAt: s.expiresAt } satisfies Stored);
      setToken(s.token);
      setCuenta(s.cuenta);
      setSalida(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => salir('expired'), Math.max(0, s.expiresAt - Date.now()));
    },
    [salir],
  );

  // Restaurar la sesión guardada (se valida contra el servidor).
  useEffect(() => {
    if (!stored) {
      write(SESSION_KEY, null);
      return;
    }
    let alive = true;
    portal
      .miCuenta(stored.token)
      .then((c) => alive && aplicarSesion({ token: stored.token, expiresAt: stored.expiresAt, cuenta: c }))
      .catch(() => alive && salir('expired'))
      .finally(() => alive && setRestaurando(false));
    return () => {
      alive = false;
    };
  }, [stored, aplicarSesion, salir]);

  const customer = useMemo<CustomerValue>(
    () => ({
      cuenta,
      token,
      restaurando,
      ingresar: async (email, password) => aplicarSesion(await portal.ingresar(email, password)),
      registrar: async (d) => aplicarSesion(await portal.registrar(d)),
      aplicarSesion,
      actualizarCuenta: setCuenta,
      salir,
      salida,
    }),
    [cuenta, token, restaurando, salida, aplicarSesion, salir],
  );

  /* ---------- Lista de solicitud ---------- */
  const [lineas, setLineas] = useState<LineaLista[]>(() => read<LineaLista[]>(LIST_KEY) ?? []);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => write(LIST_KEY, lineas.length ? lineas : null), [lineas]);

  const lista = useMemo<QuoteListValue>(
    () => ({
      lineas,
      unidades: lineas.reduce((n, l) => n + l.cant, 0),
      agregar: (p: ProductoPublico, cant = 1) =>
        setLineas((ls) =>
          ls.some((l) => l.id === p.id)
            ? ls.map((l) => (l.id === p.id ? { ...l, cant: Math.min(l.cant + cant, 10_000) } : l))
            : [...ls, { id: p.id, nombre: p.nombre, sku: p.sku, precio: p.precio, disponibilidad: p.disponibilidad, categoria: p.categoria, imagen: p.imagen, cant, nota: '' }].slice(0, 50),
        ),
      cambiar: (id, patch) =>
        setLineas((ls) =>
          ls
            .map((l) => (l.id === id ? { ...l, ...patch, cant: Math.min(Math.max(patch.cant ?? l.cant, 0), 10_000) } : l))
            .filter((l) => l.cant > 0),
        ),
      quitar: (id) => setLineas((ls) => ls.filter((l) => l.id !== id)),
      vaciar: () => setLineas([]),
      abierta,
      setAbierta,
    }),
    [lineas, abierta],
  );

  return (
    <CustomerContext.Provider value={customer}>
      <QuoteListContext.Provider value={lista}>{children}</QuoteListContext.Provider>
    </CustomerContext.Provider>
  );
}
