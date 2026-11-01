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
import { ApiError, api, errorMessage, getAll, request, setAuthToken, setUnauthorizedHandler } from '../services/api/client';
import {
  DEFAULT_CONFIG, INQUIRY_TO_API, METHOD_TO_API, MOVEMENT_TO_API, PURCHASE_STATUS, mapAuditoria, mapCatalogo, mapCliente, mapCompra,
  mapConsulta, mapCotizacion, mapConfig, mapCxc, mapDashboard, mapFichaProducto, mapMovimiento, mapOrden, mapPago, mapProducto, mapProveedor,
  mapResumenCompras, mapResumenReposicion, mapSugerencia, mapTecnico, mapVenta, type ApiPurchaseStatus,
} from '../services/api/mappers';
import * as authService from '../services/auth/authService';
import { connectRealtime, disconnectRealtime, type ChangeEvent, type RealtimeStatus } from '../services/realtime/realtime';
import type { CartLine, Database, Result, SessionUser } from '../types';
import {
  StoreContext, type CompraInput, type CondicionesPago, type DataActions, type LoadStatus, type LogoutInfo, type LogoutReason,
  type RefreshKey, type StoreValue,
} from './storeContext';

const ALL_KEYS: RefreshKey[] = ['config', 'productos', 'catalogos', 'movimientos', 'compras', 'clientes', 'proveedores', 'ventas', 'cotizaciones', 'pagos', 'cxc', 'ordenes', 'consultas', 'auditoria', 'dashboard'];

/** Qué colecciones recargar cuando el servidor avisa que cambió un módulo. */
const CHANGE_KEYS: Record<string, RefreshKey[]> = {
  products: ['productos', 'dashboard'],
  categories: ['catalogos', 'productos'],
  brands: ['catalogos', 'productos'],
  inventory: ['productos', 'movimientos', 'dashboard'],
  // Una recepción mueve stock y costo promedio.
  purchases: ['compras', 'productos', 'movimientos', 'dashboard'],
  customers: ['clientes'],
  suppliers: ['proveedores'],
  quotations: ['cotizaciones', 'dashboard'],
  sales: ['ventas', 'productos', 'movimientos', 'pagos', 'cxc', 'clientes', 'cotizaciones', 'ordenes', 'dashboard'],
  payments: ['pagos', 'cxc', 'ventas', 'clientes', 'dashboard'],
  'service-orders': ['ordenes', 'dashboard'],
  // Producción consume componentes y, al liberar un lote, entra producto terminado.
  production: ['productos', 'movimientos', 'dashboard'],
  inquiries: ['consultas', 'dashboard'],
  settings: ['config', 'dashboard'],
};

/** Espera breve para juntar varios avisos seguidos en una sola recarga. */
const REFRESH_DEBOUNCE_MS = 350;

const SESSION_KEY = 'siven.session';

const EMPTY_DB: Database = {
  productos: [], categorias: [], marcas: [], clientes: [], proveedores: [], movimientos: [], inventarioValor: 0,
  compras: [], comprasResumen: null,
  ventas: [], cotizaciones: [], pagos: [], cxc: [], ordenes: [], tecnicos: [], consultas: [], auditoria: [], dashboard: null,
  config: DEFAULT_CONFIG,
};

/** Cuerpo de POST/PATCH /purchases a partir del formulario. */
function compraToApi(d: CompraInput) {
  return {
    supplierId: d.proveedorId,
    currency: d.moneda,
    ...(d.moneda === 'USD' ? { exchangeRate: d.tipoCambio } : {}),
    expectedAt: d.esperada || null,
    additionalCosts: d.gastos ?? 0,
    notes: d.notas?.trim() || null,
    items: d.lineas.filter((l) => l.prod && l.cant > 0).map((l) => ({ productId: l.prod, quantity: l.cant, unitCost: l.costo })),
  };
}

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
  // Colecciones que no se pudieron cargar (mejora n.° 29): la pantalla ofrece reintentar solo esas.
  const [failed, setFailed] = useState<Partial<Record<RefreshKey, string>>>({});
  const [lastLogout, setLastLogout] = useState<LogoutInfo | null>(null);

  const [realtime, setRealtime] = useState<RealtimeStatus>('off');

  const userRef = useRef<SessionUser | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tiempo real: colecciones pendientes de recargar y acciones propias en curso.
  const pendingKeys = useRef(new Set<RefreshKey>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownActions = useRef({ running: 0, lastEnd: 0 });

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
      compras: async () => {
        if (!has('purchases:read')) return {};
        const r = await getAll<Json>('/purchases', {}, 5);
        return { compras: r.items.map(mapCompra), comprasResumen: mapResumenCompras(r.summary) };
      },
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
      // Impuesto y datos de la empresa: cualquier usuario autenticado.
      config: async () => ({ config: mapConfig(await api.get<Json>('/settings')) }),
    };
  }, []);

  const refresh = useCallback(
    async (keys: RefreshKey[]) => {
      const results = await Promise.allSettled(keys.map((k) => loaders[k]()));
      const patch: Partial<Database> = {};
      const errs: Partial<Record<RefreshKey, string>> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') Object.assign(patch, r.value);
        else if (!(r.reason instanceof ApiError && r.reason.status === 401)) {
          console.warn('No se pudo actualizar una colección:', r.reason);
          errs[keys[i]] = errorMessage(r.reason);
        }
      });
      if (!userRef.current) return;
      setDb((prev) => ({ ...prev, ...patch }));
      setFailed((prev) => {
        const next = { ...prev };
        keys.forEach((k) => {
          if (errs[k]) next[k] = errs[k];
          else delete next[k];
        });
        return next;
      });
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
    const errs: Partial<Record<RefreshKey, string>> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') Object.assign(patch, r.value);
      else {
        failures.push(r.reason);
        errs[ALL_KEYS[i]] = errorMessage(r.reason);
      }
    });
    setDb({ ...EMPTY_DB, ...patch });
    setFailed(errs);
    if (failures.length === results.length && failures.length > 0) {
      setStatus('error');
      setLoadError(errorMessage(failures[0]));
    } else {
      if (failures.length) console.warn('Algunas colecciones no se cargaron:', failures);
      setStatus('ready');
    }
  }, [loaders]);

  /** Junta avisos del servidor y recarga una sola vez lo afectado. */
  const queueRefresh = useCallback(
    (keys: RefreshKey[]) => {
      keys.forEach((k) => pendingKeys.current.add(k));
      if (flushTimer.current) return;
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        const batch = [...pendingKeys.current];
        pendingKeys.current.clear();
        if (userRef.current && batch.length) void refresh(batch);
      }, REFRESH_DEBOUNCE_MS);
    },
    [refresh],
  );

  const onRemoteChange = useCallback(
    (e: ChangeEvent) => {
      const me = userRef.current;
      if (!me) return;
      // Lo que hizo este mismo usuario ya se recargó al terminar su acción.
      const own = ownActions.current;
      if (e.userId === me.id && (own.running > 0 || Date.now() - own.lastEnd < 3_000)) return;
      const keys = CHANGE_KEYS[e.module];
      if (keys) queueRefresh([...keys, 'auditoria']);
    },
    [queueRefresh],
  );

  /* ---------- Sesión ---------- */
  const endSession = useCallback((reason: LogoutReason) => {
    const current = userRef.current;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
    if (current) setLastLogout({ reason, username: current.user });
    userRef.current = null;
    disconnectRealtime();
    setRealtime('off');
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    pendingKeys.current.clear();
    setAuthToken(null);
    writeSession(null);
    setUser(null);
    setDb(EMPTY_DB);
    setFailed({});
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
      connectRealtime(token, {
        onChange: onRemoteChange,
        onStatus: setRealtime,
        onReconnect: () => queueRefresh(ALL_KEYS), // pudo perderse algún aviso durante la caída
        onSessionEnded: () => {
          if (userRef.current) endSession('expired');
        },
      });
    },
    [endSession, loadAll, onRemoteChange, queueRefresh],
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
      ownActions.current.running++;
      try {
        const data = await fn();
        await refresh(keys);
        return ok(data);
      } catch (e) {
        return fail(errorMessage(e));
      } finally {
        ownActions.current.running--;
        ownActions.current.lastEnd = Date.now();
      }
    };

    const SALE_KEYS: RefreshKey[] = ['ventas', 'productos', 'movimientos', 'pagos', 'cxc', 'clientes', 'cotizaciones', 'dashboard', 'auditoria'];
    const PURCHASE_KEYS: RefreshKey[] = ['compras', 'productos', 'movimientos', 'dashboard', 'auditoria'];

    return {
      refresh,
      ejecutar: (fn, keys) => run(fn, [...keys, 'auditoria']),
      registrarAuditoria() {
        /* el backend registra la auditoría de cada operación */
      },

      guardarProducto: (id, d) =>
        run(async () => {
          const body = {
            sku: d.sku, barcode: d.codigoBarras.trim() || null, name: d.nombre, description: d.descripcion || undefined, imageUrl: d.imagen.trim() || null, unit: d.unidad,
            categoryId: d.categoriaId, brandId: d.marcaId, minStock: d.stockMin, maxStock: d.stockMax,
          };
          if (id) {
            await api.patch(`/products/${id}`, body);
            // El precio tiene su propia sección (permiso prices:write) y queda en el historial.
            if (d.precio !== undefined) await api.patch(`/products/${id}/price`, { salePrice: d.precio, ...(d.motivoPrecio ? { reason: d.motivoPrecio } : {}) });
            return id;
          }
          const creado = await api.post<{ id: string }>('/products', { ...body, ...(d.precio !== undefined && { salePrice: d.precio }) });
          return creado.id;
        }, ['productos', 'catalogos', 'dashboard', 'auditoria']),

      // Foto del producto (mejora n.° 4): sube una nueva (ya reducida en el navegador) o la quita.
      fotoProducto: (id, foto) =>
        run(async () => {
          if (!foto) {
            await api.del(`/products/${id}/image`);
            return;
          }
          const form = new FormData();
          form.append('file', foto, foto instanceof File ? foto.name : 'foto');
          await api.post(`/products/${id}/image`, form);
        }, ['productos', 'auditoria']),

      cambiarEstadoProducto: (id, activo) =>
        run(() => api.patch(`/products/${id}/status`, { isActive: activo }).then(() => undefined), ['productos', 'dashboard', 'auditoria']),

      registrarMovimiento: (d) =>
        run(async () => {
          const body: Record<string, unknown> = { productId: d.prodId, type: MOVEMENT_TO_API[d.tipo], locationId: d.ubicacionId };
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
          if (id) {
            await api.patch(`/customers/${id}`, body);
            return id;
          }
          const created = await api.post<{ id: string }>('/customers', body);
          return created.id;
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
          return { id: String(q.id), codigo: String(q.code) };
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

      cambiarPrecio: (productoId, precio, motivo) =>
        run(
          () => api.patch(`/products/${productoId}/price`, { salePrice: precio, ...(motivo.trim() ? { reason: motivo.trim() } : {}) }).then(() => undefined),
          ['productos', 'dashboard', 'auditoria'],
        ),

      historialPrecios: async (productoId) => {
        try {
          const rows = await api.get<Json[]>(`/products/${productoId}/prices`);
          return ok(
            rows.map((r) => ({
              id: String(r.id),
              precio: Number(r.price),
              desde: String(r.validFrom),
              hasta: r.validTo ? String(r.validTo) : null,
              motivo: String(r.reason ?? ''),
              usuario: r.changedBy ? `@${r.changedBy.username}` : 'Sistema',
            })),
          );
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

      cambiarEstadoConsulta: (id, estado) =>
        run(() => api.patch(`/inquiries/${id}/status`, { status: INQUIRY_TO_API[estado] }).then(() => undefined), ['consultas', 'dashboard', 'auditoria']),

      obtenerConsulta: async (id) => {
        try {
          return ok(mapConsulta(await api.get<Json>(`/inquiries/${id}`)));
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      cotizarConsulta: (id, d) =>
        run(async () => {
          const q = await api.post<Json>(`/inquiries/${id}/quotation`, {
            ...(d.cliId ? { customerId: d.cliId } : {}),
            ...(d.lineas ? { items: toItems(d.lineas) } : {}),
            ...(d.notas?.trim() ? { notes: d.notas.trim() } : {}),
            ...(d.borrador ? { asDraft: true } : {}),
          });
          return { id: String(q.id), codigo: String(q.code) };
        }, ['consultas', 'cotizaciones', 'dashboard', 'auditoria']),

      fichaProducto: async (id) => {
        try {
          return ok(mapFichaProducto(await api.get<Json>(`/products/${id}/detail`)));
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      /* ---------- Compras y reabastecimiento ---------- */
      guardarCompra: (id, d, ordenar) =>
        run(async () => {
          const body = compraToApi(d);
          let c: Json;
          if (id) {
            c = await api.patch<Json>(`/purchases/${id}`, body);
            if (ordenar) c = await api.post<Json>(`/purchases/${id}/order`);
          } else {
            c = await api.post<Json>('/purchases', { ...body, expectedAt: body.expectedAt ?? undefined, order: ordenar });
          }
          return { id: String(c.id), codigo: String(c.code) };
        }, PURCHASE_KEYS),

      actualizarSeguimientoCompra: (id, esperada, notas) =>
        run(() => api.patch(`/purchases/${id}`, { expectedAt: esperada || null, notes: notas.trim() || null }).then(() => undefined), PURCHASE_KEYS),

      ordenarCompra: (id) => run(() => api.post(`/purchases/${id}/order`).then(() => undefined), PURCHASE_KEYS),

      recibirCompra: (id, lineas, notas, ubicacionId) =>
        run(async () => {
          const c = await api.post<Json>(`/purchases/${id}/receive`, {
            items: lineas.filter((l) => l.cant > 0).map((l) => ({ purchaseItemId: l.lineaId, quantity: l.cant })),
            ...(notas.trim() ? { notes: notas.trim() } : {}),
            ...(ubicacionId ? { locationId: ubicacionId } : {}),
          });
          return { recepcion: String(c.lastReceipt?.code ?? ''), estado: PURCHASE_STATUS[c.status as ApiPurchaseStatus] ?? 'Parcial' };
        }, PURCHASE_KEYS),

      cancelarCompra: (id, motivo) => run(() => api.post(`/purchases/${id}/cancel`, { reason: motivo }).then(() => undefined), PURCHASE_KEYS),

      eliminarCompra: (id) => run(() => api.del(`/purchases/${id}`).then(() => undefined), PURCHASE_KEYS),

      obtenerCompra: async (id) => {
        try {
          return ok(mapCompra(await api.get<Json>(`/purchases/${id}`)));
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      sugerenciasReposicion: async (incluirPospuestos) => {
        try {
          const r = await request<Json[]>('GET', '/purchases/restock', { query: { includePostponed: incluirPospuestos || undefined } });
          return ok({ items: (r.data ?? []).map(mapSugerencia), resumen: mapResumenReposicion(r.summary) });
        } catch (e) {
          return fail(errorMessage(e));
        }
      },

      posponerReposicion: (productoId, dias, motivo) =>
        run(
          () => api.post(`/purchases/restock/${productoId}/postpone`, { days: dias, ...(motivo.trim() ? { reason: motivo.trim() } : {}) }).then(() => undefined),
          ['auditoria'],
        ),

      reactivarReposicion: (productoId) => run(() => api.del(`/purchases/restock/${productoId}/postpone`).then(() => undefined), ['auditoria']),
    };
  }, [refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      db,
      user,
      booting,
      status,
      loadError,
      failed,
      lastLogout,
      realtime,
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
    [db, user, booting, status, loadError, failed, lastLogout, realtime, actions, can, loadAll, startSession, endSession],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
