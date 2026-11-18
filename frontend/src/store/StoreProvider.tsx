/* =====================================================================
   Store de la aplicación (capa de datos simulada en memoria).
   Reproduce las operaciones de negocio del prototipo: validación, cálculo
   de costo promedio móvil, descuento de stock, CxC y auditoría.

   Al conectar NestJS, cada acción se reemplaza por una llamada a
   services/api y la regla de negocio pasa a vivir en el backend; los
   componentes no cambian porque solo conocen estas firmas.
   ===================================================================== */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DIAS_CREDITO, OPI_FLOW, VALIDEZ_COTIZACION } from '../config/business';
import { ROLES } from '../config/navigation';
import { createSeedDatabase } from '../services/mock/seed';
import { buildItems, cartTotals } from '../utils/documents';
import { StoreContext, type StoreValue } from './storeContext';
import { daysAgo, iso, money, nowStamp, round2, todayISO } from '../utils/format';
import type { DataActions } from './storeContext';
import type { Database, Producto, Result, SessionUser } from '../types';

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(createSeedDatabase);
  const [user, setUser] = useState<SessionUser | null>(null);
  const dbRef = useRef(db);
  const userRef = useRef(user);

  const value = useMemo<StoreValue>(() => {
    /** Aplica una operación sobre una copia del estado y la confirma (todo o nada). */
    const mutate = (fn: (d: Database) => void) => {
      const draft = structuredClone(dbRef.current);
      fn(draft);
      dbRef.current = draft;
      setDb(draft);
    };
    const uid = (d: Database, p: string) => `${p}-${++d.seq}`;
    const log = (d: Database, modulo: string, detalle: string) => {
      d.auditoria.unshift({ id: uid(d, 'LOG'), fecha: nowStamp(), usuario: userRef.current?.user ?? 'sistema', modulo, detalle });
    };
    const current = () => dbRef.current;

    const actions: DataActions = {
      registrarAuditoria(modulo, detalle) {
        mutate((d) => log(d, modulo, detalle));
      },

      /* ---------- Productos (RF-03) ---------- */
      guardarProducto(id, data) {
        if (!data.sku || !data.nombre) return fail('SKU y nombre son obligatorios');
        const dup = current().productos.some((p) => p.sku.toLowerCase() === data.sku.toLowerCase() && p.id !== id);
        if (dup) return fail('SKU duplicado: ' + data.sku);
        mutate((d) => {
          if (id) {
            const p = d.productos.find((x) => x.id === id);
            if (p) Object.assign(p, data);
            log(d, 'Productos', 'Editó producto ' + data.sku);
          } else {
            d.productos.push({ ...data, id: uid(d, 'PRD'), activo: true });
            log(d, 'Productos', 'Creó producto ' + data.sku);
          }
        });
        return ok(undefined);
      },

      /* ---------- Inventario (RF-06/07/08/09) — costo promedio móvil ---------- */
      registrarMovimiento(tipo, prodId, cant, costoInput, ref) {
        const prod = current().productos.find((x) => x.id === prodId);
        if (!prod) return fail('Seleccione un producto');
        if (!cant || cant <= 0) return fail('Cantidad inválida');
        if (tipo === 'Salida' && cant > prod.stock) return fail('No hay stock suficiente (disp. ' + prod.stock + ')');

        let resultado: Producto = prod;
        mutate((d) => {
          const p = d.productos.find((x) => x.id === prodId)!;
          let costo: number | null = null;
          if (tipo === 'Entrada') {
            costo = costoInput || p.costo;
            const nuevo = (p.stock * p.costo + cant * costo) / (p.stock + cant);
            p.costo = round2(nuevo);
            p.stock += cant;
          } else if (tipo === 'Salida') {
            p.stock -= cant;
          } else {
            p.stock = cant;
          }
          d.movimientos.push({ id: uid(d, 'MOV'), fecha: todayISO(), tipo, prod: p.id, prodN: p.nombre, cant, costo, ref: ref || tipo, resp: userRef.current?.user ?? 'sistema' });
          log(d, 'Inventario', tipo + ' ' + cant + ' u. de ' + p.sku + (costo ? ' @ ' + money(costo) : ''));
          resultado = { ...p };
        });
        return ok(resultado);
      },

      /* ---------- Clientes (RF-05) y Proveedores (RF-04) ---------- */
      guardarCliente(id, data) {
        if (!data.nombre.trim()) return fail('El nombre es obligatorio');
        mutate((d) => {
          if (id) {
            const c = d.clientes.find((x) => x.id === id);
            if (c) Object.assign(c, data);
            log(d, 'Clientes', 'Editó ' + data.nombre);
          } else {
            d.clientes.push({ ...data, id: uid(d, 'CLI') });
            log(d, 'Clientes', 'Creó ' + data.nombre);
          }
        });
        return ok(undefined);
      },

      guardarProveedor(id, data) {
        if (!data.nombre.trim()) return fail('El nombre es obligatorio');
        mutate((d) => {
          if (id) {
            const p = d.proveedores.find((x) => x.id === id);
            if (p) Object.assign(p, data);
            log(d, 'Proveedores', 'Editó ' + data.nombre);
          } else {
            d.proveedores.push({ ...data, id: uid(d, 'PRV') });
            log(d, 'Proveedores', 'Creó ' + data.nombre);
          }
        });
        return ok(undefined);
      },

      /* ---------- Cotizaciones (RF-10 / RF-11) ---------- */
      crearCotizacion(cliId, lines) {
        const { productos, clientes, cotizaciones } = current();
        const items = buildItems(productos, lines);
        if (!items.length) return fail('Agregue al menos un producto');
        const cli = clientes.find((c) => c.id === cliId);
        if (!cli) return fail('Seleccione un cliente');
        const t = cartTotals(productos, lines);
        const codigo = 'COT-' + (500 + cotizaciones.length + 1);
        mutate((d) => {
          d.cotizaciones.push({ id: uid(d, 'COT'), codigo, fecha: todayISO(), cli: cli.id, cliN: cli.nombre, items, ...t, validez: VALIDEZ_COTIZACION, estado: 'Pendiente', vendedor: userRef.current?.user ?? 'sistema' });
          log(d, 'Cotizaciones', 'Creó ' + codigo + ' para ' + cli.nombre + ' — ' + money(t.total));
        });
        return ok(codigo);
      },

      aprobarCotizacion(id) {
        const cot = current().cotizaciones.find((x) => x.id === id);
        if (!cot) return fail('Cotización no encontrada');
        mutate((d) => {
          const c = d.cotizaciones.find((x) => x.id === id)!;
          c.estado = 'Aprobada';
          log(d, 'Cotizaciones', 'Aprobó ' + c.codigo);
        });
        return ok(cot.codigo);
      },

      validarStockCotizacion(id) {
        const { cotizaciones, productos } = current();
        const cot = cotizaciones.find((x) => x.id === id);
        if (!cot) return fail('Cotización no encontrada');
        for (const it of cot.items) {
          const p = productos.find((x) => x.id === it.prod);
          if (!p || p.stock < it.cant) return fail('Stock insuficiente de ' + it.prodN);
        }
        return ok(undefined);
      },

      /* ---------- Ventas y facturación (RF-12/13/14) ---------- */
      confirmarVenta(cliId, metodo, lines, cotId) {
        const { productos, clientes, ventas } = current();
        const items = buildItems(productos, lines);
        if (!items.length) return fail('Agregue productos');
        for (const it of items) {
          const p = productos.find((x) => x.id === it.prod)!;
          if (p.stock < it.cant) return fail('Stock insuficiente: ' + it.prodN + ' (disp. ' + p.stock + ')');
        }
        const cli = clientes.find((c) => c.id === cliId);
        if (!cli) return fail('Seleccione un cliente');

        const t = cartTotals(productos, lines);
        const factura = 'FAC-' + (2401 + ventas.length);
        const credito = metodo === 'Crédito';
        let ventaId = '';

        mutate((d) => {
          ventaId = uid(d, 'VTA');
          const resp = userRef.current?.user ?? 'sistema';
          d.ventas.push({
            id: ventaId, factura, fecha: todayISO(), cli: cli.id, cliN: cli.nombre, vendedor: resp,
            items, ...t, metodo, estado: credito ? 'Pendiente' : 'Pagada', saldo: credito ? t.total : 0,
            vence: credito ? iso(daysAgo(-DIAS_CREDITO)) : null,
          });
          items.forEach((it) => {
            const p = d.productos.find((x) => x.id === it.prod)!;
            p.stock -= it.cant;
            d.movimientos.push({ id: uid(d, 'MOV'), fecha: todayISO(), tipo: 'Salida', prod: p.id, prodN: p.nombre, cant: it.cant, costo: null, ref: factura, resp });
          });
          if (!credito) d.pagos.push({ id: uid(d, 'PAG'), fecha: todayISO(), venta: ventaId, factura, monto: t.total, metodo });
          if (cotId) {
            const c = d.cotizaciones.find((x) => x.id === cotId);
            if (c) c.estado = 'Convertida';
          }
          log(d, 'Ventas', 'Registró ' + factura + ' — ' + cli.nombre + ' — ' + money(t.total) + ' (' + metodo + ')');
        });
        return ok({ ventaId, factura });
      },

      /* ---------- Pagos y CxC (RF-14/15) ---------- */
      registrarPago(ventaId, montoInput, metodo) {
        const venta = current().ventas.find((x) => x.id === ventaId);
        if (!venta) return fail('Venta no encontrada');
        if (!montoInput || montoInput <= 0) return fail('Monto inválido');
        const monto = Math.min(montoInput, venta.saldo);
        let saldo = venta.saldo;
        mutate((d) => {
          const v = d.ventas.find((x) => x.id === ventaId)!;
          v.saldo = round2(v.saldo - monto);
          v.estado = v.saldo <= 0 ? 'Pagada' : 'Parcial';
          saldo = v.saldo;
          d.pagos.push({ id: uid(d, 'PAG'), fecha: todayISO(), venta: v.id, factura: v.factura, monto, metodo });
          log(d, 'Pagos', 'Abono de ' + money(monto) + ' a ' + v.factura + ' — saldo ' + money(v.saldo));
        });
        return ok(saldo);
      },

      /* ---------- Órdenes de servicio OPI (RF-21) ---------- */
      crearOrden(cliente, desc, tecnico) {
        if (!desc.trim()) return fail('Describa el servicio');
        const codigo = 'OPI-' + (301 + current().ordenes.length);
        mutate((d) => {
          d.ordenes.push({ id: uid(d, 'OPI'), codigo, fecha: todayISO(), cli: cliente, desc: desc.trim(), tecnico: tecnico.trim() || '—', estado: tecnico.trim() ? 'Asignada' : 'Registrada' });
          log(d, 'OPI', 'Creó ' + codigo);
        });
        return ok(codigo);
      },

      avanzarOrden(id) {
        const orden = current().ordenes.find((x) => x.id === id);
        if (!orden) return fail('Orden no encontrada');
        const idx = OPI_FLOW.indexOf(orden.estado);
        if (idx < 0 || idx >= OPI_FLOW.length - 1) return fail('La orden no puede avanzar');
        const siguiente = OPI_FLOW[idx + 1];
        mutate((d) => {
          const o = d.ordenes.find((x) => x.id === id)!;
          o.estado = siguiente;
          if (o.tecnico === '—') o.tecnico = 'Téc. asignado';
          log(d, 'OPI', o.codigo + ' → ' + o.estado);
        });
        return ok(orden.codigo + ': ' + siguiente);
      },

      cancelarOrden(id) {
        const orden = current().ordenes.find((x) => x.id === id);
        if (!orden) return fail('Orden no encontrada');
        mutate((d) => {
          const o = d.ordenes.find((x) => x.id === id)!;
          o.estado = 'Cancelada';
          log(d, 'OPI', 'Canceló ' + o.codigo);
        });
        return ok(orden.codigo);
      },

      /* ---------- Consultas web (RF-16/17) ---------- */
      crearConsulta(nombre, contacto, msg) {
        if (!nombre.trim()) return fail('Indique su nombre o empresa');
        mutate((d) => {
          d.consultas.unshift({ id: uid(d, 'CON'), fecha: todayISO(), nombre: nombre.trim(), contacto, msg, estado: 'Nueva' });
          log(d, 'Consultas', 'Nueva consulta web de ' + nombre.trim());
        });
        return ok(undefined);
      },

      atenderConsulta(id) {
        mutate((d) => {
          const c = d.consultas.find((x) => x.id === id);
          if (!c) return;
          c.estado = 'Atendida';
          log(d, 'Consultas', 'Atendió consulta de ' + c.nombre);
        });
        return ok(undefined);
      },
    };

    return {
      db,
      user,
      actions,
      /* ---------- Autenticación simulada ---------- */
      login(role, username) {
        const r = ROLES[role];
        const u: SessionUser = { role, user: username || r.user, name: r.name, color: r.color };
        userRef.current = u;
        setUser(u);
        mutate((d) => log(d, 'Seguridad', 'Inicio de sesión — rol ' + r.name));
        return u;
      },
      logout() {
        mutate((d) => log(d, 'Seguridad', 'Cierre de sesión'));
        userRef.current = null;
        setUser(null);
      },
    };
  }, [db, user]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
