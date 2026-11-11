/* Piezas comunes del panel de administración. */
import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/common/Icon';
import { useToast } from '../../components/feedback/useToast';
import { Field } from '../../components/forms/Field';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { Tag } from '../../components/tables/Tag';
import { errorMessage, type Pagination } from '../../services/api/client';
import { fmtDateTime } from '../../utils/format';
import type { passwordRules } from '../../utils/passwordPolicy';
import { accion, MODULOS, quien } from './actividad';
import { generarContrasena, type Evento } from './adminApi';

export function AdminHead({ titulo, desc, acciones }: { titulo: string; desc: string; acciones?: ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{titulo}</h1>
        <p>{desc}</p>
      </div>
      {acciones && <div className="adm-head-actions">{acciones}</div>}
    </div>
  );
}

export function Vacio({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="adm-empty">
        {msg}
      </td>
    </tr>
  );
}

/** Ventana de confirmación; si la acción falla, muestra el error y deja la ventana abierta. */
export function Confirmar({
  titulo,
  boton,
  peligro = false,
  children,
  onConfirmar,
}: {
  titulo: string;
  boton: string;
  peligro?: boolean;
  children: ReactNode;
  onConfirmar: () => Promise<void>;
}) {
  const { close } = useModal();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ok = async () => {
    setBusy(true);
    try {
      await onConfirmar();
      close();
    } catch (e) {
      toast(errorMessage(e), 'err');
      setBusy(false);
    }
  };
  return (
    <Modal
      title={titulo}
      footer={
        <>
          <button type="button" className="b b-out" onClick={close}>
            Cancelar
          </button>
          <button type="button" className={`b ${peligro ? 'b-red' : 'b-green'}`} onClick={ok} disabled={busy}>
            {busy ? 'Guardando…' : boton}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/** Contraseña temporal generada (o escrita) con las reglas de la política a la vista. */
export function ClaveTemporal({ valor, onCambio, reglas }: { valor: string; onCambio: (v: string) => void; reglas: ReturnType<typeof passwordRules> }) {
  const toast = useToast();
  const copiar = () =>
    navigator.clipboard
      ?.writeText(valor)
      .then(() => toast('Contraseña copiada', 'ok'))
      .catch(() => toast('No se pudo copiar; selecciónela y cópiela a mano', 'err'));
  return (
    <div className="adm-pass">
      <Field label="Contraseña temporal" htmlFor="u-clave" help="Entréguela a la persona en privado. Se genera sola; puede escribir otra.">
        <div className="adm-pass-row">
          <input id="u-clave" className="mono" value={valor} onChange={(e) => onCambio(e.target.value)} maxLength={72} autoComplete="new-password" spellCheck={false} />
          <button type="button" className="b b-out b-sm" onClick={() => onCambio(generarContrasena())} title="Generar otra">
            <Icon name="refresh-cw" size={14} /> Otra
          </button>
          <button type="button" className="b b-out b-sm" onClick={copiar}>
            Copiar
          </button>
        </div>
      </Field>
      <ul className="adm-rules">
        {reglas.map((r) => (
          <li key={r.id} className={r.ok ? 'ok' : ''}>
            {r.ok ? '✓' : '•'} {r.label.replace('su nombre de usuario', 'el nombre de usuario')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista compacta de eventos de la bitácora (fichas de usuario y de cuenta). */
export function ListaEventos({ eventos, vacio, conQuien = false }: { eventos: Evento[] | null; vacio: string; conQuien?: boolean }) {
  if (!eventos) return <p className="muted-sm">Cargando…</p>;
  if (!eventos.length) return <p className="muted-sm">{vacio}</p>;
  return (
    <ul className="adm-events">
      {eventos.map((e) => {
        const [txt, tono] = accion(e.action);
        return (
          <li key={e.id}>
            <span className="mono adm-events-when">{fmtDateTime(e.createdAt)}</span>
            <span>
              <Tag tone={tono}>{txt}</Tag> <span className="muted-sm">{MODULOS[e.module] ?? e.module}</span>
              {conQuien && <span className="muted-sm"> · por {quien(e)}</span>}
              {e.description && e.description.toLowerCase() !== txt.toLowerCase() && <span className="adm-events-desc">{e.description}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Anterior / Siguiente para listas paginadas en el servidor. */
export function Paginador({ p, onPagina }: { p: Pagination | null; onPagina: (n: number) => void }) {
  if (!p || p.totalPages <= 1) return null;
  return (
    <div className="adm-pager">
      <span className="muted-sm">
        Página {p.page} de {p.totalPages} · {p.total} registros
      </span>
      <button type="button" className="b b-out b-sm" disabled={p.page <= 1} onClick={() => onPagina(p.page - 1)}>
        <Icon name="chevron-left" size={14} /> Anterior
      </button>
      <button type="button" className="b b-out b-sm" disabled={p.page >= p.totalPages} onClick={() => onPagina(p.page + 1)}>
        Siguiente <Icon name="chevron-right" size={14} />
      </button>
    </div>
  );
}
