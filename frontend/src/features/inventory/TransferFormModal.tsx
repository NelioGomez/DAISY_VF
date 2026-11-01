/* Nuevo traslado entre la bodega y la sucursal (mejora n.° 23). Solo cambia dónde está la
   mercadería: el stock total y el costo promedio no se mueven. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { BODEGA, otraUbicacion, UBICACIONES, type UbicacionId } from '../../utils/locations';
import { trasladosApi } from './transfersApi';
import { useRecords } from '../records/records';

interface Linea {
  prodId: string;
  cant: string;
}

const enUbicacion = (p: Producto | undefined, loc: UbicacionId) => (p ? (loc === BODEGA ? p.stockBodega : p.stockSucursal) : 0);

export function TransferFormModal({ productoId, origen: origenInicial = BODEGA }: { productoId?: string; origen?: UbicacionId }) {
  const { db, ejecutar } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const [origen, setOrigen] = useState<UbicacionId>(origenInicial);
  const destino = otraUbicacion(origen);
  const [lineas, setLineas] = useState<Linea[]>([{ prodId: productoId ?? '', cant: '1' }]);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const disponibles = db.productos.filter((p) => p.activo && (enUbicacion(p, origen) > 0 || lineas.some((l) => l.prodId === p.id)));
  const nombre = (id: UbicacionId) => UBICACIONES.find((u) => u.id === id)!.nombre;
  const setLinea = (i: number, patch: Partial<Linea>) => setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const unidades = lineas.reduce((t, l) => t + (Number(l.cant) || 0), 0);

  const guardar = async () => {
    const validas = lineas.filter((l) => l.prodId);
    if (!validas.length) return toast('Agregue al menos un producto', 'err');
    const ids = validas.map((l) => l.prodId);
    if (new Set(ids).size !== ids.length) return toast('Hay productos repetidos: sume las cantidades en una sola línea', 'err');
    for (const l of validas) {
      const q = Number(l.cant);
      const p = prod(l.prodId);
      if (!Number.isInteger(q) || q <= 0) return toast('Las cantidades deben ser enteros mayores que cero', 'err');
      if (p && q > enUbicacion(p, origen)) return toast(`${p.sku}: en ${nombre(origen)} hay ${enUbicacion(p, origen)}`, 'err');
    }
    setSaving(true);
    const r = await ejecutar(
      () => trasladosApi.crear({ origenId: origen, destinoId: destino, lineas: validas.map((l) => ({ prodId: l.prodId, cant: Number(l.cant) })), nota }),
      ['productos', 'movimientos'],
    );
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Traslado ${r.data.codigo}: ${r.data.unidades} u. de ${r.data.origen} a ${r.data.destino}`, 'ok');
    openRecord('traslado', r.data.id);
  };

  return (
    <Modal
      title="Trasladar mercadería"
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={guardar} disabled={saving}>
            {saving ? 'Trasladando…' : `Trasladar ${unidades || ''} u.`}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Desde" htmlFor="tr-origen">
          <select id="tr-origen" value={origen} onChange={(e) => setOrigen(Number(e.target.value) as UbicacionId)}>
            {UBICACIONES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hacia">
          <input value={nombre(destino)} disabled />
        </Field>
      </div>

      <div className="li-head li-transfer">
        <span>Producto</span>
        <span>En {UBICACIONES.find((u) => u.id === origen)!.corto.toLowerCase()}</span>
        <span>Cantidad</span>
        <span />
      </div>
      {lineas.map((l, i) => {
        const p = prod(l.prodId);
        const hay = enUbicacion(p, origen);
        const excede = !!p && Number(l.cant) > hay;
        return (
          <div className="li-row li-transfer" key={i}>
            <select value={l.prodId} onChange={(e) => setLinea(i, { prodId: e.target.value })} aria-label={`Producto de la línea ${i + 1}`}>
              <option value="">— producto —</option>
              {disponibles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({x.sku})
                </option>
              ))}
            </select>
            <input value={p ? hay : ''} disabled aria-label={`Disponible en el origen, línea ${i + 1}`} />
            <input
              type="number"
              min={1}
              max={hay || undefined}
              value={l.cant}
              onChange={(e) => setLinea(i, { cant: e.target.value })}
              aria-label={`Cantidad a trasladar, línea ${i + 1}`}
              aria-invalid={excede || undefined}
              className={excede ? 'is-invalid' : undefined}
            />
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} aria-label={`Quitar línea ${i + 1}`} disabled={lineas.length === 1}>
              ×
            </button>
          </div>
        );
      })}
      <button className="b b-out b-sm" style={{ marginTop: 6 }} onClick={() => setLineas((ls) => [...ls, { prodId: '', cant: '1' }])}>
        + Agregar producto
      </button>

      <Field label="Motivo" htmlFor="tr-nota" full>
        <input id="tr-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} placeholder="Ej: surtido semanal de la sucursal" />
      </Field>
      <div className="note" style={{ marginTop: 10 }}>
        <span className="ic">ℹ️</span>
        <div>
          Se registra una <b>salida</b> en {nombre(origen)} y una <b>entrada</b> en {nombre(destino)} por cada producto. Las ventas toman primero de la sucursal y, si no
          alcanza, de la bodega.
        </div>
      </div>
    </Modal>
  );
}
