/* =====================================================================
   Store conectado a la API NestJS.
   - Sesión: JWT en memoria + sessionStorage (sobrevive a recargar la
     pestaña, se borra al cerrarla). Se cierra sola cuando el token vence
     o el servidor responde 401.
   - Datos: tras iniciar sesión se cargan solo las colecciones que los
     permisos del usuario permiten; cada operación refresca lo que afecta.
   - Las reglas de negocio (stock, saldos, numeración, auditoría) las
     aplica el servidor; aquí solo se envía la intención y se muestra el
     resultado confirmado.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api, errorMessage, getAll, setAuthToken, setUnauthorizedHandler } from '../services/api/client';
import {
  INQUIRY_TO_API, METHOD_TO_API, MOVEMENT_TO_API, mapAuditoria, mapCatalogo, mapCliente, mapConsulta, mapCotizacion,
  mapCxc, mapDashboard, mapMovimiento, mapOrden, mapPago, mapProducto, mapProveedor, mapTecnico, mapVenta,
} from '../services/api/mappers';
import * as authService from '../services/auth/authService';
import type { CartLine, Database, Result, SessionUser } from '../types';
import {
  StoreContext, type CondicionesPago, type DataActions, type LoadStatus, type LogoutInfo, type LogoutReason,
  type RefreshKey, type StoreValue,
} from './storeContext';

const ALL_KEYS: RefreshKey[] = ['productos', 'catalogos', 'movimientos', 'clientes', 'proveedores', 'ventas', 'cotizaciones', 'pagos', 'cxc', 'ordenes', 'consultas', 'auditoria', 'dashboard'];

const SESSION_KEY = 'siven.session';

const EMPTY_DB: Database = {
  productos: [], categorias: [], marcas: [], clientes: [], proveedores: [], movimientos: [], inventarioValor: 0,
  ventas: [], cotizaciones: [], pagos: [], cxc: [], ordenes: [], tecnicos: [], consultas: [], auditoria: [], dashboard: null,
};

interface StoredSession {
  token: string;
  expiresAt: number;
  /** Para precargar el login si la sesión no se puede restaurar. */
  username: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s.token ? s : null;
  } catch {
    return null;
  }
}

function writeSession(s: StoredSession | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const toItems = (lines: CartLine[]) => lines.filter((l) => l.prod && l.cant > 0).map((l) => ({ productId: l.prod, quantity: l.cant }));

function termsToApi(t: CondicionesPago) {
  return {
    paymentMethod: METHOD_TO_API[t.metodo],
    ...(t.metodo === 'Crédito' && t.diasCredito ? { creditDays: t.diasCredito } : {}),
    ...(t.metodo === 'Crédito' && t.abonoInicial ? { initialPayment: t.abonoInicial, initialPaymentMethod: METHOD_TO_API[t.metodoAbono ?? 'Contado'] } : {}),
    ...(t.referencia?.trim() ? { reference: t.referencia.trim() } : {}),
  };
}

const emptyToNull = (v: string) => (v.trim() ? v.trim() : null);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(EMPTY_DB);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(() => readSession() !== null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLogout, setLastLogout] = useState<LogoutInfo | null>(null);

  const userRef = useRef<SessionUser | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const can = useCallback((p: string) => !!userRef.current?.permissions.includes(p), []);

  /* ---------- Cargadores por colección (respetan permisos) ---------- */
  const loaders = useMemo<Record<RefreshKey, () => Promise<Partial<Database>>>>(() => {
    const has = (p: string) => !!userRef.current?.permissions.includes(p);
    return {
      productos: async () => {
        if (has('inventory:read')) {
          const r = await getAll<Json>('/inventory');
          return { productos: r.items.map(mapProducto), inventarioValor: Number(r.summary?.stockValue ?? 0) };
        }
        if (has('products:read')) return { productos: (await getAll<Json>('/products')).items.map(mapProducto) };
        return {};
      },
      catalogos: async () => ({
        ...(has('categories:read') ? { categorias: (await getAll<Json>('/categories')).items.map(mapCatalogo) } : {}),
        ...(has('brands:read') ? { marcas: (await getAll<Json>('/brands')).items.map(mapCatalogo) } : {}),
      }),
      movimientos: async () => (has('inventory:read') ? { movimientos: (await getAll<Json>('/inventory/movements', {}, 2)).items.map(mapMovimiento) } : {}),
      clientes: async () => (has('customers:read') ? { clientes: (await getAll<Json>('/customers')).items.map(mapCliente) } : {}),
      proveedores: async () => (has('suppliers:read') ? { proveedores: (await getAll<Json>('/suppliers')).items.map(mapProveedor) } : {}),
      ventas: async () => (has('sales:read') ? { ventas: (await getAll<Json>('/sales')).items.map(mapVenta) } : {}),
      cotizaciones: async () => (has('quotations:read') ? { cotizaciones: (await getAll<Json>('/quotations')).items.map(mapCotizacion) } : {}),
      pagos: async () => (has('payments:read') ? { pagos: (await getAll<Json>('/payments', {}, 3)).items.map(mapPago) } : {}),
      cxc: async () => (has('payments:read') ? { cxc: (await getAll<Json>('/payments/receivables')).items.map(mapCxc) } : {}),
      ordenes: async () =>
        has('service-orders:read')
          ? {
              ordenes: (await getAll<Json>('/service-orders')).items.map(mapOrden),
              tecnicos: ((await api.get<Json[]>('/service-orders/technicians')) ?? []).map(mapTecnico),
            }
          : {},
      consultas: async () => (has('inquiries:read') ? { consultas: (await getAll<Json>('/inquiries')).items.map(mapConsulta) } : {}),
      auditoria: async () => (has('audit:read') ? { auditoria: (await getAll<Json>('/audit', {}, 1)).items.map(mapAuditoria) } : {}),
      dashboard: async () => (has('dashboard:read') ? { dashboard: mapDashboard(await api.get<Json>('/dashboard/summary')) } : {}),
    };
  }, []);

  const refresh = useCallback(
    async (keys: RefreshKey[]) => {
      const results = await Promise.allSettled(keys.map((k) => loaders[k]()));
      const patch: Partial<Database> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') Object.assign(patch, r.value);
        else if (!(r.reason instanceof ApiError && r.reason.status === 401)) console.warn('No se pudo actualizar una colección:', r.reason);
      });
      if (userRef.current) setDb((prev) => ({ ...prev, ...patch }));
    },
    [loaders],
  );

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    const results = await Promise.allSettled(ALL_KEYS.map((k) => loaders[k]()));
    if (!userRef.current) return;
    const patch: Partial<Database> = {};
    const failures: unknown[] = [];
    results.forEach((r) => (r.status === 'fulfilled' ? Object.assign(patch, r.value) : failures.push(r.reason)));
    setDb({ ...EMPTY_DB, ...patch });
    if (failures.length === results.length && failures.length > 0) {
      setStatus('error');
      setLoadError(errorMessage(failures[0]));
    } else {
      if (failures.length) console.warn('Algunas colecciones no se cargaron:', failures);
      setStatus('ready');
    }
  }, [loaders]);

  /* ---------- Sesión ---------- */
  const endSession = useCallback((reason: LogoutReason) => {
    const current = userRef.current;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
    if (current) setLastLogout({ reason, username: current.user });
    userRef.current = null;
    setAuthToken(null);
    writeSession(null);
    setUser(null);
    setDb(EMPTY_DB);
    setStatus('idle');
  }, []);

  const startSession = useCallback(
    (u: SessionUser, token: string, expiresAt: number) => {
      setAuthToken(token);
      writeSession({ token, expiresAt, username: u.user });
      userRef.current = u;
      setUser(u);
      setLastLogout(null);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      expiryTimer.current = setTimeout(() => endSession('expired'), Math.max(0, expiresAt - Date.now()));
      void loadAll();
    },
    [endSession, loadAll],
  );

  // Si el servidor rechaza el token (vencido o usuario desactivado), se cierra la sesión.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) endSession('expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Restaurar la sesión guardada al recargar la página.
  useEffect(() => {
    const saved = readSession();
    if (!saved) return;
    const drop = (reason: LogoutReason) => {
      if (saved.username) setLastLogout({ reason, username: saved.username });
      setAuthToken(null);
      if (reason !== 'offline') writeSession(null); // sin conexión se conserva para reintentar al recargar
    };
    const vigente = saved.expiresAt > Date.now() + 5_000;
    if (vigente) setAuthToken(saved.token);
    (vigente ? authService.me() : Promise.reject(new ApiError(401, 'Sesión vencida')))
      .then((u) => startSession(u, saved.token, saved.expiresAt))
      .catch((e) => drop(e instanceof ApiError && e.status === 0 ? 'offline' : 'expired'))
      .finally(() => setBooting(false));
  }, [startSession]);

  /* ---------- Acciones de negocio ---------- */
  const actions = useMemo<DataActions>(() => {
    const run = async <T,>(fn: () => Promise<T>, keys: RefreshKey[]): Promise<Result<T>> => {
      try {
        const data = await fn();
        await refresh(keys);
        return ok(data);
      } catch (e) {
        return fail(errorMessage(e));
      }
    };

    const SALE_KEYS: RefreshKey[] = ['ventas', 'productos', 'movimientos', 'pagos', 'cxc', 'clientes', 'cotizaciones', 'dashboard', 'auditoria'];

    return {
      refresh,
      registrarAuditoria() {
        /* el backend registra la auditoría de cada operación */
      },

      guardarProducto: (id, d) =>
        run(async () => {
          const body = {
            sku: d.sku, name: d.nombre, description: d.descripcion || undefined,
            categoryId: d.categoriaId, brandId: d.marcaId, salePrice: d.precio, minStock: d.stockMin,
          };
          if (id) await api.patch(`/products/${id}`, body);
          else await api.post('/products', body);
        }, ['productos', 'catalogos', 'dashboard', 'auditoria']),

      cambiarEstadoProducto: (id, activo) =>
        run(() => api.patch(`/products/${id}/status`, { isActive: activo }).then(() => undefined), ['productos', 'dashboard', 'auditoria']),

      registrarMovimiento: (d) =>
        run(async () => {
          const body: Record<string, unknown> = { productId: d.prodId, type: MOVEMENT_TO_API[d.tipo] };
          if (d.tipo === 'Ajuste') body.newStock = d.nuevoStock;
          else body.quantity = d.cantidad;
          if (d.tipo === 'Entrada') {
            body.unitCost = d.costo;
            if (d.proveedorId) body.supplierId = d.proveedorId;
          }
          if (d.ref.trim()) body.reference = d.ref.trim();
          if (d.nota.trim()) body.note = d.nota.trim();
          const m = await api.post<Json>('/inventory/movements', body);
          return { sku: String(m?.product?.sku ?? ''), stock: Number(m?.product?.stock ?? m?.movement?.stockAfter ?? 0) };
        }, ['productos', 'movimientos', 'dashboard', 'auditoria']),

      guardarCliente: (id, d) =>
        run(async () => {
          const body = { name: d.nombre, ruc: emptyToNull(d.ruc), contactName: emptyToNull(d.contacto), phone: emptyToNull(d.tel), email: emptyToNull(d.correo), address: emptyToNull(d.dir) };
          if (id) await api.patch(`/customers/${id}`, body);
          else await api.post('/customers', body);
        }, ['clientes', 'auditoria']),

      guardarProveedor: (id, d) =>
        run(async () => {
          const body = { name: d.nombre, taxId: emptyToNull(d.ruc), country: emptyToNull(d.pais), contactName: emptyToNull(d.contacto), phone: emptyToNull(d.tel), email: emptyToNull(d.correo), address: emptyToNull(d.dir) };
          if (id) await api.patch(`/suppliers/${id}`, body);
          else await api.post('/suppliers', body);
        }, ['proveedores', 'auditoria']),

      crearCotizacion: (cliId, lines, notas) =>
        run(async () => {
          const q = await api.post<Json>('/quotations', { customerId: cliId, items: toItems(lines), ...(notas.trim() ? { notes: notas.trim() } : {}) });
          return String(q.code);
        }, ['cotizaciones', 'dashboard', 'auditoria']),

      cambiarEstadoCotizacion: (id, accion, motivo) =>
        run(() => api.post(`/quotations/${id}/${accion}`, accion === 'reject' && motivo ? { reason: motivo } : {}).then(() => undefined), ['cotizaciones', 'dashboard', 'auditoria']),

      obtenerCotizacion: async (id) => {
        try {
          return ok(mapCotizacion(await api.get<Json>(`/quotations/${id}`)));
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      convertirCotizacion: (id, terms) =>
        run(async () => {
          const s = await api.post<Json>(`/quotations/${id}/convert`, termsToApi(terms));
          return { ventaId: String(s.id), factura: String(s.invoiceNumber) };
        }, SALE_KEYS),

      confirmarVenta: (cliId, lines, terms) =>
        run(async () => {
          const s = await api.post<Json>('/sales', { customerId: cliId, items: toItems(lines), ...termsToApi(terms) });
          return { ventaId: String(s.id), factura: String(s.invoiceNumber) };
        }, SALE_KEYS),

      obtenerVenta: async (id) => {
        try {
          return ok(mapVenta(await api.get<Json>(`/sales/${id}`)));
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      anularVenta: (id, motivo) => run(() => api.post(`/sales/${id}/void`, { reason: motivo }).then(() => undefined), SALE_KEYS),

      registrarPago: (ventaId, monto, metodo, referencia) =>
        run(
          () => api.post('/payments', { saleId: ventaId, amount: monto, method: METHOD_TO_API[metodo], ...(referencia.trim() ? { reference: referencia.trim() } : {}) }).then(() => undefined),
          ['pagos', 'cxc', 'ventas', 'clientes', 'dashboard', 'auditoria'],
        ),

      crearOrden: (cliId, desc, tecnicoId) =>
        run(async () => {
          const o = await api.post<Json>('/service-orders', { customerId: cliId, description: desc, ...(tecnicoId ? { technicianId: tecnicoId } : {}) });
          return String(o.code);
        }, ['ordenes', 'dashboard', 'auditoria']),

      asignarOrden: (id, tecnicoId) => run(() => api.post(`/service-orders/${id}/assign`, { technicianId: tecnicoId }).then(() => undefined), ['ordenes', 'dashboard', 'auditoria']),
      iniciarOrden: (id) => run(() => api.post(`/service-orders/${id}/start`).then(() => undefined), ['ordenes', 'dashboard', 'auditoria']),
      completarOrden: (id, resumen) =>
        run(() => api.post(`/service-orders/${id}/complete`, resumen.trim() ? { summary: resumen.trim() } : {}).then(() => undefined), ['ordenes', 'dashboard', 'auditoria']),
      facturarOrden: (id, ventaId) => run(() => api.post(`/service-orders/${id}/invoice`, { saleId: ventaId }).then(() => undefined), ['ordenes', 'dashboard', 'auditoria']),
      cancelarOrden: (id, motivo) => run(() => api.post(`/service-orders/${id}/cancel`, { reason: motivo }).then(() => undefined), ['ordenes', 'dashboard', 'auditoria']),

      crearConsulta: async (nombre, contacto, producto, msg) => {
        try {
          await api.post('/public/inquiries', { name: nombre.trim(), contact: contacto.trim(), ...(producto.trim() ? { productInterest: producto.trim() } : {}), ...(msg.trim() ? { message: msg.trim() } : {}) }, false);
          if (userRef.current) await refresh(['consultas', 'dashboard']);
          return ok(undefined);
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      cambiarEstadoConsulta: (id, estado) =>
        run(() => api.patch(`/inquiries/${id}/status`, { status: INQUIRY_TO_API[estado] }).then(() => undefined), ['consultas', 'dashboard', 'auditoria']),
    };
  }, [refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      db,
      user,
      booting,
      status,
      loadError,
      lastLogout,
      actions,
      can,
      reload: loadAll,
      async login(username, password) {
        const res = await authService.login(username, password);
        if (!res.ok) return res;
        startSession(res.user, res.token, res.expiresAt);
        return { ok: true, user: res.user };
      },
      logout(reason = 'manual') {
        if (!userRef.current) return;
        if (reason === 'manual' || reason === 'idle') void authService.logout();
        endSession(reason);
      },
    }),
    // `user` se incluye para que `can` (estable) se reevalúe en los componentes al cambiar de sesión.
    [db, user, booting, status, loadError, lastLogout, actions, can, loadAll, startSession, endSession],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
