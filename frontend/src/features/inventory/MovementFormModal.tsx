import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Producto, TipoMovimiento } from '../../types';
import { money } from '../../utils/format';
import { BODEGA, UBICACIONES, type UbicacionId } from '../../utils/locations';

const PLACEHOLDER: Record<TipoMovimiento, string> = {
  Entrada: 'N° de compra o factura del proveedor',
  Salida: 'Donación, consignación, daño…',
  Ajuste: 'Conteo físico del día…',
};

const enUbicacion = (p: Producto, loc: UbicacionId) => (loc === BODEGA ? p.stockBodega : p.stockSucursal);

export function MovementFormModal({ tipo, productoId }: { tipo: TipoMovimiento; productoId?: string }) {
  const { db, registrarMovimiento } = useData();
  const toast = useToast();
  const { close } = useModal();
  const activos = db.productos.filter((p) => p.activo);
  const [prodId, setProdId] = useState(productoId ?? activos[0]?.id ?? '');
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [ref, setRef] = useState('');
  const [nota, setNota] = useState('');
  const [ubicacion, setUbicacion] = useState<UbicacionId>(BODEGA);
  const [saving, setSaving] = useState(false);
  const prod = db.productos.find((p) => p.id === prodId);
  const lugar = UBICACIONES.find((u) => u.id === ubicacion)!;
  const aqui = prod ? enUbicacion(prod, ubicacion) : 0;

  const save = async () => {
    const qty = Math.round(Number(cant));
    if (!prod) return toast('Seleccione un producto', 'err');
    if (tipo === 'Ajuste' ? !(cant !== '' && qty >= 0) : !(qty > 0)) return toast(tipo === 'Ajuste' ? 'Indique la existencia contada' : 'La cantidad debe ser mayor que cero', 'err');
    if (tipo === 'Salida' && qty > aqui) return toast(`No hay stock suficiente en ${lugar.nombre} (disponible: ${aqui})`, 'err');
    if (tipo === 'Ajuste' && qty === aqui) return toast(`El sistema ya registra ${aqui} en ${lugar.nombre}`, 'err');
    if (tipo === 'Entrada' && (costo === '' || Number(costo) < 0)) return toast('Indique el costo unitario de compra', 'err');
    setSaving(true);
    const r = await registrarMovimiento({
      tipo,
      prodId,
      ...(tipo === 'Ajuste' ? { nuevoStock: qty } : { cantidad: qty }),
      ...(tipo === 'Entrada' ? { costo: Number(costo), proveedorId: proveedorId || undefined } : {}),
      ubicacionId: ubicacion,
      ref,
      nota,
    });
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${tipo} registrada en ${lugar.corto.toLowerCase()} · stock total ${r.data.sku || prod.sku}: ${r.data.stock}`, 'ok');
    close();
  };

  return (
    <Modal
      title={`Registrar ${tipo.toLowerCase()} de inventario`}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Registrando…' : `Registrar ${tipo.toLowerCase()}`}
          </button>
        </>
      }
    >
      <Field label="Producto">
        <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
          {activos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku}) — bodega {p.stockBodega} · sucursal {p.stockSucursal}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Ubicación" htmlFor="mv-ubicacion" help={prod ? `Hay ${aqui} en ${lugar.corto.toLowerCase()} (total ${prod.stock})` : undefined}>
          <select id="mv-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(Number(e.target.value) as UbicacionId)}>
            {UBICACIONES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Field>
        <InputField
          label={tipo === 'Ajuste' ? `Existencia contada en ${lugar.corto.toLowerCase()}` : 'Cantidad'}
          type="number"
          value={cant}
          onChange={setCant}
          help={tipo === 'Ajuste' && prod ? `Hoy el sistema registra ${aqui} en ${lugar.corto.toLowerCase()}` : tipo === 'Salida' && prod ? `Máximo ${aqui}` : undefined}
        />
        {tipo === 'Entrada' && (
          <InputField label="Costo unitario (C$)" type="number" value={costo} onChange={setCosto} help={prod ? `Costo promedio actual: ${money(prod.costo)}` : undefined} />
        )}
        {tipo === 'Entrada' && (
          <Field label="Proveedor">
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">— Sin proveedor —</option>
              {db.proveedores.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Referencia">
          <input value={ref} placeholder={PLACEHOLDER[tipo]} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Nota" full>
          <input value={nota} placeholder="Opcional" onChange={(e) => setNota(e.target.value)} />
        </Field>
      </div>
      {tipo === 'Entrada' && (
        <div className="note">
          <span className="ic">ℹ️</span>
          <div>
            El servidor recalcula el costo promedio: <b>(stock × costo actual + cantidad × costo nuevo) ÷ stock total</b>.
          </div>
        </div>
      )}
      {tipo === 'Ajuste' && (
        <div className="note">
          <span className="ic">ℹ️</span>
          <div>El ajuste fija la existencia de la ubicación al valor contado y deja registrada la diferencia; el total cambia en esa diferencia.</div>
        </div>
      )}
    </Modal>
  );
}
