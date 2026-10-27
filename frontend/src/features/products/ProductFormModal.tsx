/* Alta y edición de productos (datos maestros).
   El costo promedio y el stock NO se editan aquí: los calcula el servidor a
   partir de los movimientos de inventario (corrección P0 del análisis UX). */
import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useAuth, useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { money } from '../../utils/format';

export function ProductFormModal({ producto }: { producto?: Producto }) {
  const { db, guardarProducto, cambiarEstadoProducto } = useData();
  const { can } = useAuth();
  // El precio comercial lo fijan Administración y Gerencia; el resto da de alta sin precio.
  const canPrice = can('prices:write');
  const toast = useToast();
  const { close } = useModal();
  const p = producto;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    sku: p?.sku ?? '',
    nombre: p?.nombre ?? '',
    descripcion: p?.descripcion ?? '',
    categoriaId: p?.categoriaId ?? '',
    marcaId: p?.marcaId ?? '',
    precio: String(p?.precio ?? ''),
    stockMin: String(p?.stockMin ?? 0),
    motivoPrecio: '',
    activo: p?.activo ?? true,
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.sku.trim() || !f.nombre.trim()) return toast('SKU y nombre son obligatorios', 'err');
    if (canPrice && (f.precio === '' || Number(f.precio) < 0)) return toast('Indique un precio de venta válido', 'err');
    const precio = Number(f.precio);
    const cambiaPrecio = canPrice && (!p || precio !== p.precio);
    setSaving(true);
    const r = await guardarProducto(p?.id ?? null, {
      sku: f.sku.trim().toUpperCase(),
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim(),
      categoriaId: f.categoriaId || null,
      marcaId: f.marcaId || null,
      ...(cambiaPrecio && { precio, motivoPrecio: f.motivoPrecio.trim() || undefined }),
      stockMin: Math.max(0, Math.round(Number(f.stockMin) || 0)),
    });
    if (r.ok && p && f.activo !== p.activo) {
      const s = await cambiarEstadoProducto(p.id, f.activo);
      if (!s.ok) {
        setSaving(false);
        return toast(s.error, 'err');
      }
    }
    setSaving(false);
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
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <InputField label="SKU" value={f.sku} onChange={set('sku')} placeholder="Ej: DSP-NZL-13" help="Letras, números, punto, guion o diagonal" />
        <Field label="Marca">
          <select value={f.marcaId} onChange={(e) => set('marcaId')(e.target.value)}>
            <option value="">— Sin marca —</option>
            {db.marcas.filter((m) => m.activo || m.id === f.marcaId).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Field>
        <InputField label="Nombre del producto" value={f.nombre} onChange={set('nombre')} full />
        <Field label="Categoría">
          <select value={f.categoriaId} onChange={(e) => set('categoriaId')(e.target.value)}>
            <option value="">— Sin categoría —</option>
            {db.categorias.filter((c) => c.activo || c.id === f.categoriaId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        {canPrice ? (
          <InputField label="Precio de venta (C$)" type="number" value={f.precio} onChange={set('precio')} help="Cada cambio queda en el historial de precios" />
        ) : (
          <Field label="Precio de venta" help="Lo establece Gerencia o Administración">
            <input value={p && p.precio > 0 ? `C$ ${p.precio.toFixed(2)}` : 'Sin precio'} disabled />
          </Field>
        )}
        {canPrice && p && f.precio !== '' && Number(f.precio) !== p.precio && (
          <InputField label="Motivo del cambio de precio" value={f.motivoPrecio} onChange={set('motivoPrecio')} placeholder="Ej: ajuste por tipo de cambio" full />
        )}
        <InputField label="Stock mínimo" type="number" value={f.stockMin} onChange={set('stockMin')} help="Debajo de este nivel se marca como crítico" />
        {p && (
          <Field label="Estado">
            <select value={f.activo ? '1' : '0'} onChange={(e) => setF((s) => ({ ...s, activo: e.target.value === '1' }))}>
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>
        )}
        <Field label="Descripción" full>
          <textarea rows={2} value={f.descripcion} onChange={(e) => set('descripcion')(e.target.value)} />
        </Field>
      </div>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>
          {p ? (
            <>
              Existencia actual: <b>{p.stock}</b> · costo promedio: <b>{money(p.costo)}</b>. Ambos cambian solo con movimientos de Inventario.
            </>
          ) : (
            <>El producto se crea sin existencias. Registre una entrada en Inventario para darle stock y costo.</>
          )}
        </div>
      </div>
    </Modal>
  );
}
