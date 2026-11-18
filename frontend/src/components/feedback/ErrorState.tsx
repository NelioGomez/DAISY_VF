/* Error recuperable (mejora n.° 29): explica qué falló y ofrece reintentar sin recargar la página. */
interface ErrorStateProps {
  msg: string;
  onRetry?: () => void;
  /** Título; por defecto "No se pudo cargar la información". */
  title?: string;
}

export function ErrorState({ msg, onRetry, title = 'No se pudo cargar la información.' }: ErrorStateProps) {
  return (
    <div className="note note-danger err-state" role="alert">
      <span className="ic" aria-hidden="true">
        ⚠️
      </span>
      <div>
        <b>{title}</b> {msg}
        {onRetry && (
          <div className="err-actions">
            <button type="button" className="b b-out b-sm" onClick={onRetry}>
              ↻ Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** La misma tarjeta dentro de una tabla. */
export function ErrorRow({ cols, msg, onRetry }: ErrorStateProps & { cols: number }) {
  return (
    <tr>
      <td colSpan={cols}>
        <ErrorState msg={msg} onRetry={onRetry} />
      </td>
    </tr>
  );
}
