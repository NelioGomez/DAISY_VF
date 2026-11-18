/* Precio comercial de un producto con su historial (Administración / Gerencia).
   Cada cambio lo registra un trigger de la base de datos: quién, cuándo y por qué. */
import { useEffect, useState } from 'react';
import { InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { PrecioHistorial, Producto } from '../../types';
import { fmtDateTime, money } from '../../utils/format';

export function PriceModal({ producto }: { producto: Producto }) {
  const { cambiarPrecio, historialPrecios } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [precio, setPrecio] = useState(producto.precio > 0 ? String(producto.precio) : '');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<PrecioHistorial[] | null>(null);

  useEffect(() => {
    let alive = true;
    void historialPrecios(producto.id).then((r) => alive && setHistorial(r.ok ? r.data : []));
    return () => {
      alive = false;
    };
  }, [historialPrecios, producto.id]);

  const nuevo = Number(precio);
  const valido = precio !== '' && Number.isFinite(nuevo) && nuevo >= 0;
  const cambia = valido && nuevo !== producto.precio;
  const margen = producto.costo > 0 && nuevo > 0 ? Math.round(((nuevo - producto.costo) / nuevo) * 1000) / 10 : null;

  const save = async () => {
    if (!valido) return toast('Indique un precio válido', 'err');
    if (!cambia) return toast('El precio no cambió', 'err');
    setSaving(true);
    const r = await cambiarPrecio(producto.id, nuevo, motivo);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Precio de ${producto.sku}: ${money(nuevo)}`, 'ok');
    close();
  };

  return (
    <Modal
      title={`Precio · ${producto.sku}`}
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving || !cambia}>
            {saving ? 'Guardando…' : 'Guardar precio'}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>
        <b>{producto.nombre}</b> · vigente {producto.precio > 0 ? money(producto.precio) : 'sin precio'} · costo promedio {money(producto.costo)}
      </p>
      <div className="form-grid">
        <InputField
          label="Nuevo precio (C$)"
          type="number"
          value={precio}
          onChange={setPrecio}
          help={margen !== null ? `Margen sobre costo promedio: ${margen}%` : undefined}
        />
        <InputField label="Motivo" value={motivo} onChange={setMotivo} placeholder="Ej: nueva lista del proveedor" />
      </div>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>Las ventas y cotizaciones ya emitidas conservan el precio con que se hicieron.</div>
      </div>

      <h3 style={{ margin: '16px 0 8px' }}>Historial</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Desde</th>
              <th>Hasta</th>
              <th className="num">Precio</th>
              <th>Usuario</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {historial === null && (
              <tr>
                <td colSpan={5}>Cargando…</td>
              </tr>
            )}
            {historial?.length === 0 && (
              <tr>
                <td colSpan={5}>Sin cambios registrados</td>
              </tr>
            )}
            {historial?.map((h) => (
              <tr key={h.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {fmtDateTime(h.desde)}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {h.hasta ? fmtDateTime(h.hasta) : <b>vigente</b>}
                </td>
                <td className="num">{money(h.precio)}</td>
                <td className="mono">{h.usuario}</td>
                <td>{h.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
