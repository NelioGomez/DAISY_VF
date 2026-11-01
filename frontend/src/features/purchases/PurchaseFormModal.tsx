/* Nueva compra o edición de un borrador. El costo unitario es el del proveedor, en la
   moneda de la compra; el servidor calcula el costo puesto en bodega (C$, con gastos). */
import { useMemo, useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useData } from '../../store/hooks';
import type { Compra, Moneda } from '../../types';
import { money } from '../../utils/format';
import { moneyIn } from './purchaseFormat';
import { useRecords } from '../records/records';

interface LineState {
  prod: string;
  cant: string;
  costo: string;
}

export interface PurchasePreset {
  proveedorId?: string;
  moneda?: Moneda;
  notas?: string;
  lineas: Array<{ prod: string; cant: number; costo?: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PurchaseFormModal({ compra, preset }: { compra?: Compra; preset?: PurchasePreset }) {
  const { db, guardarCompra } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const proveedores = db.proveedores.filter((p) => p.activo || p.id === (compra?.proveedorId ?? preset?.proveedorId));
  const productos = db.productos.filter((p) => p.activo);
  const lastRate = db.compras.find((c) => c.moneda === 'USD')?.tipoCambio;

  const [proveedorId, setProveedorId] = useState(compra?.proveedorId ?? preset?.proveedorId ?? '');
  const [moneda, setMoneda] = useState<Moneda>(compra?.moneda ?? preset?.moneda ?? 'NIO');
  const [tipoCambio, setTipoCambio] = useState(String(compra?.moneda === 'USD' ? compra.tipoCambio : (lastRate ?? '')));
  const [esperada, setEsperada] = useState(compra?.esperada ? compra.esperada.slice(0, 10) : '');
  const [gastos, setGastos] = useState(compra && compra.gastos ? String(compra.gastos) : '');
  const [notas, setNotas] = useState(compra?.notas ?? preset?.notas ?? '');
  const [lineas, setLineas] = useState<LineState[]>(() => {
    if (compra?.items?.length) return compra.items.map((i) => ({ prod: i.prod, cant: String(i.cant), costo: String(i.costo) }));
    if (preset?.lineas.length) return preset.lineas.map((l) => ({ prod: l.prod, cant: String(l.cant), costo: l.costo !== undefined ? String(l.costo) : '' }));
    return [{ prod: '', cant: '1', costo: '' }];
  });
  const [saving, setSaving] = useState<'draft' | 'order' | null>(null);

  const rate = moneda === 'USD' ? Number(tipoCambio) : 1;
  const sub = useMemo(() => round2(lineas.reduce((a, l) => a + (Number(l.cant) || 0) * (Number(l.costo) || 0), 0)), [lineas]);
  const extra = Number(gastos) || 0;
  const total = round2(sub + extra);

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLineas((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        // Al elegir el producto se propone su costo promedio (solo en córdobas, que es su moneda).
        if (patch.prod && !l.costo && moneda === 'NIO') {
          const p = db.productos.find((x) => x.id === patch.prod);
          if (p && p.costo > 0) next.costo = String(p.costo);
        }
        return next;
      }),
    );

  const save = async (ordenar: boolean) => {
    if (!proveedorId) return toast('Seleccione el proveedor', 'err');
    const valid = lineas.filter((l) => l.prod);
    if (!valid.length) return toast('Agregue al menos un producto', 'err');
    const ids = valid.map((l) => l.prod);
    if (new Set(ids).size !== ids.length) return toast('Hay productos repetidos: sume las cantidades en una sola línea', 'err');
    if (valid.some((l) => !(Number(l.cant) > 0) || !Number.isInteger(Number(l.cant)))) return toast('Las cantidades deben ser enteros mayores que cero', 'err');
    if (valid.some((l) => l.costo === '' || Number(l.costo) < 0)) return toast('Indique el costo unitario de cada producto', 'err');
    if (moneda === 'USD' && !(rate > 0)) return toast('Indique el tipo de cambio (C$ por US$)', 'err');
    if (extra < 0) return toast('Los gastos no pueden ser negativos', 'err');
    setSaving(ordenar ? 'order' : 'draft');
    const r = await guardarCompra(
      compra?.id ?? null,
      {
        proveedorId,
        moneda,
        ...(moneda === 'USD' ? { tipoCambio: rate } : {}),
        esperada: esperada || undefined,
        gastos: extra,
        notas,
        lineas: valid.map((l) => ({ prod: l.prod, cant: Math.round(Number(l.cant)), costo: Number(l.costo) })),
      },
      ordenar,
    );
    setSaving(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Compra ${r.data.codigo} ${ordenar ? 'ordenada: queda pendiente de recibir' : 'guardada como borrador'}`, 'ok');
    openRecord('compra', r.data.id);
  };

  return (
    <Modal
      title={compra ? `Editar borrador ${compra.codigo}` : 'Nueva compra'}
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-out" onClick={() => save(false)} disabled={!!saving}>
            {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button className="b b-amber" onClick={() => save(true)} disabled={!!saving}>
            {saving === 'order' ? 'Ordenando…' : 'Guardar y ordenar'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Proveedor" htmlFor="pf-prov">
          <select id="pf-prov" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">— Seleccione —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.internacional ? ` (${p.pais})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moneda" htmlFor="pf-moneda">
          <select id="pf-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
            <option value="NIO">Córdobas (C$)</option>
            <option value="USD">Dólares (US$)</option>
          </select>
        </Field>
        {moneda === 'USD' && (
          <InputField id="pf-rate" label="Tipo de cambio (C$ por US$)" type="number" value={tipoCambio} onChange={setTipoCambio} placeholder="36.6243" help="Convierte el costo a córdobas al recibir" />
        )}
        <Field label="Llegada esperada" htmlFor="pf-fecha">
          <input id="pf-fecha" type="date" value={esperada} onChange={(e) => setEsperada(e.target.value)} />
        </Field>
        <InputField
          id="pf-gastos"
          label={`Flete, aduana y otros gastos (${moneda === 'USD' ? 'US$' : 'C$'})`}
          type="number"
          value={gastos}
          onChange={setGastos}
          placeholder="0.00"
          help="Se reparten en el costo según el valor de cada línea"
        />
      </div>

      <div className="li-head li-purchase">
        <span>Producto</span>
        <span>Cant.</span>
        <span>Costo unit.</span>
        <span>Subtotal</span>
        <span />
      </div>
      {lineas.map((l, i) => {
        const p = db.productos.find((x) => x.id === l.prod);
        return (
          <div className="li-row li-purchase" key={i}>
            <select value={l.prod} onChange={(e) => setLine(i, { prod: e.target.value })} aria-label={`Producto de la línea ${i + 1}`}>
              <option value="">— producto —</option>
              {productos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({x.sku}) · stock {x.stock}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={l.cant} onChange={(e) => setLine(i, { cant: e.target.value })} aria-label={`Cantidad de la línea ${i + 1}`} />
            <input type="number" min={0} step="0.01" value={l.costo} onChange={(e) => setLine(i, { costo: e.target.value })} aria-label={`Costo unitario de la línea ${i + 1}`} placeholder={p && moneda === 'NIO' ? String(p.costo) : '0.00'} />
            <input value={moneyIn((Number(l.cant) || 0) * (Number(l.costo) || 0), moneda)} disabled aria-label={`Subtotal de la línea ${i + 1}`} />
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} aria-label={`Quitar línea ${i + 1}`} disabled={lineas.length === 1}>
              ×
            </button>
          </div>
        );
      })}
      <button className="b b-out b-sm" style={{ marginTop: 6 }} onClick={() => setLineas((ls) => [...ls, { prod: '', cant: '1', costo: '' }])}>
        + Agregar producto
      </button>

      <div className="totbox">
        <div className="r">
          <span>Subtotal</span>
          <span>{moneyIn(sub, moneda)}</span>
        </div>
        <div className="r">
          <span>Gastos</span>
          <span>{moneyIn(extra, moneda)}</span>
        </div>
        <div className="r grand">
          <span>Total</span>
          <span>{moneyIn(total, moneda)}</span>
        </div>
        {moneda === 'USD' && rate > 0 && (
          <div className="r" style={{ color: 'var(--muted)', fontSize: 12 }}>
            <span>En córdobas</span>
            <span>{money(round2(total * rate))}</span>
          </div>
        )}
      </div>

      <Field label="Notas" full>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} placeholder="Condiciones, número de proforma del proveedor…" />
      </Field>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>
          Un <b>borrador</b> se puede seguir editando. Al <b>ordenar</b>, la compra queda pendiente de recibir; el inventario cambia solo cuando registre la recepción.
        </div>
      </div>
    </Modal>
  );
}
