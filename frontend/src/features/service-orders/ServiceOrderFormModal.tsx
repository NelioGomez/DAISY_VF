/* Nueva orden de servicio (mejora n.° 60). Puede ir "con costo" (se factura al terminar) o "en
   garantía" (no se cobra): en ese caso se elige qué la cubre, un producto que el cliente compró
   con garantía vigente o un servicio anterior cuya garantía de trabajo sigue en pie. También se
   crea desde una solicitud de servicio técnico o un reclamo (la solicitud queda atendida) y
   desde el detalle de una orden, como reclamo de la garantía de ese trabajo. */
import { useEffect, useMemo, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { Icon } from '../../components/common/Icon';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import type { Cliente, ConsultaWeb, OpcionesGarantia, OrdenServicio } from '../../types';
import { fmtDate } from '../../utils/format';
import { plazoGarantia, vigenciaTexto } from '../../utils/warranty';
import { useRecords } from '../records/records';

type Cobertura = 'costo' | 'garantia';

/** Cliente registrado cuyo correo o teléfono aparece en el contacto de una solicitud web. */
function sugerirCliente(clientes: Cliente[], contacto: string): Cliente | undefined {
  const texto = contacto.toLowerCase();
  const digitos = contacto.replace(/\D/g, '');
  return clientes.find((c) => {
    if (c.correo && texto.includes(c.correo.toLowerCase())) return true;
    const tel = c.tel.replace(/\D/g, '');
    return tel.length >= 7 && digitos.includes(tel.slice(-8));
  });
}

export function ServiceOrderFormModal({ solicitud, garantiaDe }: { solicitud?: ConsultaWeb; garantiaDe?: OrdenServicio }) {
  const { db, crearOrden, opcionesGarantia } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const activos = useMemo(() => db.clientes.filter((c) => c.activo), [db.clientes]);
  const sugerido = solicitud && !solicitud.cliente ? sugerirCliente(activos, solicitud.contacto) : undefined;

  const [cliId, setCliId] = useState(() => garantiaDe?.cliId ?? solicitud?.cliente?.id ?? sugerido?.id ?? (solicitud ? '' : (activos[0]?.id ?? '')));
  const [cobertura, setCobertura] = useState<Cobertura>(garantiaDe ? 'garantia' : 'costo');
  const [fuente, setFuente] = useState(garantiaDe ? `o:${garantiaDe.id}` : '');
  const [opciones, setOpciones] = useState<{ cliId: string; data: OpcionesGarantia | null; error: string } | null>(null);
  const [desc, setDesc] = useState(() => {
    if (garantiaDe) return `Reclamo en garantía de ${garantiaDe.codigo}: `;
    if (!solicitud) return '';
    return [solicitud.producto && `Equipo: ${solicitud.producto}.`, solicitud.msg].filter(Boolean).join(' ');
  });
  const [tecnicoId, setTecnicoId] = useState('');
  const [saving, setSaving] = useState(false);

  // Qué puede cubrir la garantía de este cliente (se consulta al elegir "En garantía").
  useEffect(() => {
    if (cobertura !== 'garantia' || !cliId) return;
    let alive = true;
    void opcionesGarantia(cliId).then((r) => alive && setOpciones({ cliId, data: r.ok ? r.data : null, error: r.ok ? '' : r.error }));
    return () => {
      alive = false;
    };
  }, [cobertura, cliId, opcionesGarantia]);

  const ops = opciones?.cliId === cliId ? opciones : null;
  const compras = ops?.data?.compras ?? [];
  const servicios = (ops?.data?.servicios ?? []).filter((s) => s.vigente);

  const cambiarCliente = (id: string) => {
    setCliId(id);
    setFuente('');
  };

  const save = async () => {
    if (!cliId) return toast('Seleccione el cliente', 'err');
    if (desc.trim().length < 5) return toast('Describa el trabajo o la falla', 'err');
    if (cobertura === 'garantia' && !fuente) return toast('Elija qué cubre la garantía: un producto comprado o un servicio anterior', 'err');
    const [k, a, b] = fuente.split(':');
    const garantia = cobertura === 'garantia' ? (k === 'o' ? { ordenId: a } : { ventaId: a, productoId: b }) : null;
    setSaving(true);
    const r = await crearOrden({ cliId, desc: desc.trim(), tecnicoId: tecnicoId || null, garantia, solicitudId: solicitud?.id ?? null });
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Orden ${r.data.codigo} creada${garantia ? ' en garantía' : ''}${solicitud ? ` · ${solicitud.codigo} atendida` : ''}`, 'ok');
    openRecord('servicio', r.data.id);
  };

  return (
    <Modal
      title={garantiaDe ? `Reclamo en garantía de ${garantiaDe.codigo}` : solicitud ? `Orden de servicio para ${solicitud.codigo}` : 'Nueva orden de servicio'}
      wide
      footer={
        <>
          {garantiaDe ? (
            <button className="b b-out" onClick={() => openRecord('servicio', garantiaDe.id)}>
              Volver
            </button>
          ) : (
            <CancelButton />
          )}
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Creando…' : cobertura === 'garantia' ? 'Crear orden en garantía' : 'Crear orden'}
          </button>
        </>
      }
    >
      {solicitud && (
        <blockquote className="quote-msg">
          <b>
            {solicitud.nombre} · {solicitud.contacto}
          </b>
          {'\n'}
          {solicitud.msg || solicitud.producto}
        </blockquote>
      )}

      <div className="form-grid">
        <Field
          label="Cliente"
          htmlFor="opi-cliente"
          full
          help={
            garantiaDe
              ? 'El reclamo es del mismo cliente de la orden original.'
              : solicitud && !solicitud.cliente
                ? sugerido && cliId === sugerido.id
                  ? 'Sugerido: su correo o teléfono coincide con el contacto de la solicitud.'
                  : 'La solicitud no está enlazada a un cliente. Si no está registrado, créelo primero en Clientes.'
                : undefined
          }
        >
          <select id="opi-cliente" value={cliId} onChange={(e) => cambiarCliente(e.target.value)} disabled={!!garantiaDe || !!solicitud?.cliente}>
            {!cliId && <option value="">— Elija el cliente —</option>}
            {activos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.ruc ? ` · ${c.ruc}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!garantiaDe && (
        <fieldset className="opi-cob" aria-label="Cobertura">
          <legend className="section-title">Cobertura</legend>
          <label className={`opi-cob-opt ${cobertura === 'costo' ? 'is-on' : ''}`}>
            <input type="radio" name="opi-cob" checked={cobertura === 'costo'} onChange={() => setCobertura('costo')} />
            <span>
              <b>Con costo</b>
              <small>Se factura al terminar el trabajo</small>
            </span>
          </label>
          <label className={`opi-cob-opt ${cobertura === 'garantia' ? 'is-on' : ''}`}>
            <input type="radio" name="opi-cob" checked={cobertura === 'garantia'} onChange={() => setCobertura('garantia')} />
            <span>
              <b>
                <Icon name="shield-check" size={14} /> En garantía
              </b>
              <small>No se cobra: lo cubre una compra o un servicio anterior</small>
            </span>
          </label>
        </fieldset>
      )}

      {cobertura === 'garantia' && !garantiaDe && (
        <div className="wr-box" aria-live="polite">
          {!cliId ? (
            <p className="muted-sm">Elija el cliente para ver sus compras con garantía.</p>
          ) : !ops ? (
            <p className="muted-sm">Buscando compras y servicios con garantía…</p>
          ) : ops.error ? (
            <div className="note note-danger">
              <span className="ic">⛔</span>
              <div>{ops.error}</div>
            </div>
          ) : !compras.length && !servicios.length ? (
            <div className="note note-warn">
              <span className="ic">⚠️</span>
              <div>
                Este cliente no tiene compras de productos con garantía ni servicios con garantía vigente. La garantía de cada producto se registra en su
                ficha (Productos › Garantía); si no aplica, registre la orden con costo.
              </div>
            </div>
          ) : (
            <>
              {compras.length > 0 && (
                <div role="radiogroup" aria-label="Productos comprados con garantía">
                  <div className="wr-h">Productos comprados</div>
                  {compras.map((c) => {
                    const key = `c:${c.ventaId}:${c.productoId}`;
                    return (
                      <label key={key} className={`wr-opt ${fuente === key ? 'is-on' : ''} ${c.vigente ? '' : 'is-off'}`}>
                        <input type="radio" name="opi-fuente" value={key} checked={fuente === key} disabled={!c.vigente} onChange={() => setFuente(key)} />
                        <span className="wr-main">
                          <b>{c.producto}</b>
                          <small>
                            {c.factura} · {fmtDate(c.fecha)} · {c.cantidad} u. · garantía de {plazoGarantia(c.dias)}
                          </small>
                        </span>
                        <Tag tone={c.vigente ? 't-green' : 't-gray'}>{c.vigente ? `hasta ${fmtDate(c.hasta)}` : `venció ${fmtDate(c.hasta)}`}</Tag>
                      </label>
                    );
                  })}
                </div>
              )}
              {servicios.length > 0 && (
                <div role="radiogroup" aria-label="Servicios anteriores con garantía de trabajo">
                  <div className="wr-h">Servicios anteriores (garantía del trabajo)</div>
                  {servicios.map((s) => {
                    const key = `o:${s.ordenId}`;
                    return (
                      <label key={key} className={`wr-opt ${fuente === key ? 'is-on' : ''}`}>
                        <input type="radio" name="opi-fuente" value={key} checked={fuente === key} onChange={() => setFuente(key)} />
                        <span className="wr-main">
                          <b>{s.codigo}</b>
                          <small>
                            {s.desc}
                            {s.fin ? ` · terminado ${fmtDate(s.fin)}` : ''}
                          </small>
                        </span>
                        <Tag tone="t-green">hasta {fmtDate(s.hasta)}</Tag>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {garantiaDe && (
        <div className="note">
          <span className="ic">🛡️</span>
          <div>
            Cubre la garantía del trabajo de <b>{garantiaDe.codigo}</b> ({vigenciaTexto(garantiaDe.garantiaTrabajo?.hasta)}). La nueva orden no se cobra.
          </div>
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field label={cobertura === 'garantia' ? 'Falla que reporta el cliente' : 'Descripción del servicio'} htmlFor="opi-desc" full>
          <textarea id="opi-desc" rows={3} maxLength={4000} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Técnico asignado" htmlFor="opi-tecnico" help="Opcional: puede asignarse después">
          <select id="opi-tecnico" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {db.tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
