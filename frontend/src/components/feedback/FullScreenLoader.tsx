/* Pantalla de espera mientras se restaura la sesión o se cargan los datos. */
export function FullScreenLoader({ text }: { text: string }) {
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <span className="loader-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

/** Bloque de espera dentro de una vista. */
export function ViewLoader({ text = 'Cargando datos…' }: { text?: string }) {
  return (
    <div className="view-loader" role="status" aria-live="polite">
      <span className="loader-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
