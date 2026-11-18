/* Ajuste de inventario (mejora n.° 57). Ya no hay entradas ni salidas manuales: las entradas
   llegan con la recepción de compras y con producción, y las salidas con ventas y producción,
   cada una con su documento en la línea de tiempo de movimientos. El ajuste fija la existencia
   contada en una ubicación y exige un motivo (conteo, merma, uso interno…), que queda en el
   movimiento y en la auditoría. */
import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { BODEGA, UBICACIONES, type UbicacionId } from '../../utils/locations';

const MOTIVOS = ['Conteo físico', 'Merma o daño', 'Uso interno', 'Donación o muestra', 'Corrección de registro', 'Otro'] as const;
type Motivo = (typeof MOTIVOS)[number];

const enUbicacion = (p: Producto, loc: UbicacionId) => (loc === BODEGA ? p.stockBodega : p.stockSucursal);

export function AdjustmentFormModal({ productoId }: { productoId?: string }) {
  const { db, registrarMovimiento } = useData();
  const toast = useToast();
  const { close } = useModal();
  const activos = db.productos.filter((p) => p.activo);
  const [prodId, setProdId] = useState(productoId ?? activos[0]?.id ?? '');
  const [cant, setCant] = useState('');
  const [motivo, setMotivo] = useState<Motivo>('Conteo físico');
  const [detalle, setDetalle] = useState('');
  const [ref, setRef] = useState('');
  const [ubicacion, setUbicacion] = useState<UbicacionId>(BODEGA);
  const [saving, setSaving] = useState(false);
  const prod = db.productos.find((p) => p.id === prodId);
  const lugar = UBICACIONES.find((u) => u.id === ubicacion)!;
  const aqui = prod ? enUbicacion(prod, ubicacion) : 0;
  const qty = Math.round(Number(cant));
  const valido = cant !== '' && Number.isFinite(qty) && qty >= 0;
  const diferencia = valido ? qty - aqui : 0;

  const save = async () => {
    if (!prod) return toast('Seleccione un producto', 'err');
    if (!valido) return toast('Indique la existencia contada', 'err');
    if (qty === aqui) return toast(`El sistema ya registra ${aqui} en ${lugar.nombre}`, 'err');
    const nota = motivo === 'Otro' ? detalle.trim() : [motivo, detalle.trim()].filter(Boolean).join(': ');
    if (nota.length < 5) return toast('Describa el motivo del ajuste (mínimo 5 caracteres)', 'err');
    setSaving(true);
    const r = await registrarMovimiento({ tipo: 'Ajuste', prodId, nuevoStock: qty, ubicacionId: ubicacion, ref, nota });
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Ajuste registrado en ${lugar.corto.toLowerCase()} · stock total ${r.data.sku || prod.sku}: ${r.data.stock}`, 'ok');
    close();
  };

  return (
    <Modal
      title="Ajuste de inventario"
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar ajuste'}
          </button>
        </>
      }
    >
      <Field label="Producto" htmlFor="aj-producto">
        <select id="aj-producto" value={prodId} onChange={(e) => setProdId(e.target.value)}>
          {activos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku}) — bodega {p.stockBodega} · sucursal {p.stockSucursal}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Ubicación" htmlFor="aj-ubicacion" help={prod ? `Hoy el sistema registra ${aqui} en ${lugar.corto.toLowerCase()} (total ${prod.stock})` : undefined}>
          <select id="aj-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(Number(e.target.value) as UbicacionId)}>
            {UBICACIONES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Field>
        <InputField
          id="aj-cantidad"
          label={`Existencia contada en ${lugar.corto.toLowerCase()}`}
          type="number"
          value={cant}
          onChange={setCant}
          help={valido && diferencia !== 0 ? `Diferencia: ${diferencia > 0 ? '+' : '−'}${Math.abs(diferencia)} u.` : undefined}
        />
        <Field label="Motivo" htmlFor="aj-motivo">
          <select id="aj-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia" htmlFor="aj-ref">
          <input id="aj-ref" value={ref} placeholder="Acta de conteo, n.° de reporte…" onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label={motivo === 'Otro' ? 'Describa el motivo' : 'Detalle'} htmlFor="aj-detalle" full>
          <input
            id="aj-detalle"
            value={detalle}
            placeholder={motivo === 'Otro' ? 'Obligatorio' : 'Opcional, p. ej. 2 unidades golpeadas en el traslado'}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </Field>
      </div>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>
          El ajuste fija la existencia de la ubicación al valor contado y deja registrada la diferencia con su motivo. Las entradas de mercadería se
          registran al <b>recibir una compra</b> (Compras), que también actualiza el costo promedio.
        </div>
      </div>
    </Modal>
  );
}
