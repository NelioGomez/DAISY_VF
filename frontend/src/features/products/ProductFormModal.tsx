import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { CATEGORIAS } from '../../config/business';
import { useData } from '../../store/hooks';
import type { Producto } from '../../types';

export function ProductFormModal({ producto }: { producto?: Producto }) {
  const { guardarProducto } = useData();
  const toast = useToast();
  const { close } = useModal();
  const p = producto;
  const [f, setF] = useState({
    sku: p?.sku ?? '',
    marca: p?.marca ?? '',
    nombre: p?.nombre ?? '',
    categoria: p?.categoria ?? CATEGORIAS[0],
    ic: p?.ic ?? '🔩',
    costo: String(p?.costo ?? ''),
    precio: String(p?.precio ?? ''),
    stock: String(p?.stock ?? 0),
    stockMin: String(p?.stockMin ?? 0),
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const r = guardarProducto(p?.id ?? null, {
      sku: f.sku.trim(),
      nombre: f.nombre.trim(),
      marca: f.marca,
      categoria: f.categoria,
      ic: f.ic || '🔩',
      costo: +f.costo || 0,
      precio: +f.precio || 0,
      stock: +f.stock || 0,
      stockMin: +f.stockMin || 0,
    });
    if (!r.ok) return toast(r.error, 'err');
    toast(p ? 'Producto actualizado' : 'Producto creado', 'ok');
    close();
  };

  return (
    <Modal
      title={p ? 'Editar producto' : 'Nuevo producto'}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <InputField label="SKU" value={f.sku} onChange={set('sku')} placeholder="Ej: DSP-NZL-13" />
        <InputField label="Marca" value={f.marca} onChange={set('marca')} />
        <InputField label="Nombre del producto" value={f.nombre} onChange={set('nombre')} full />
        <Field label="Categoría">
          <select value={f.categoria} onChange={(e) => set('categoria')(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <InputField label="Ícono (emoji)" value={f.ic} onChange={set('ic')} />
        <InputField label="Costo (C$)" type="number" value={f.costo} onChange={set('costo')} />
        <InputField label="Precio venta (C$)" type="number" value={f.precio} onChange={set('precio')} />
        <InputField label="Stock actual" type="number" value={f.stock} onChange={set('stock')} />
        <InputField label="Stock mínimo" type="number" value={f.stockMin} onChange={set('stockMin')} />
      </div>
    </Modal>
  );
}
