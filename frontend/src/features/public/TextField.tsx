/* Campo de texto del sitio público y del portal de clientes. */
interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  error?: string;
  help?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  readOnly?: boolean;
}

/** Campo de texto del sitio público con etiqueta, ayuda y error accesibles. */
export function TextField({ id, label, value, onChange, error, help, type = 'text', autoComplete, maxLength, readOnly }: TextFieldProps) {
  const describedBy = error ? `${id}-err` : help ? `${id}-help` : undefined;
  return (
    <div className={`pub-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
      {error ? (
        <span id={`${id}-err`} className="pub-field-err">
          {error}
        </span>
      ) : (
        help && (
          <span id={`${id}-help`} className="pub-field-help">
            {help}
          </span>
        )
      )}
    </div>
  );
}
