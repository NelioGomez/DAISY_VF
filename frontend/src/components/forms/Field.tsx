import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  help?: string;
  full?: boolean;
  htmlFor?: string;
}

/** Contenedor de campo con etiqueta (estilo .field del prototipo). */
export function Field({ label, children, help, full, htmlFor }: FieldProps) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help && <div className="help">{help}</div>}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange(value: string): void;
  type?: 'text' | 'number' | 'password' | 'email';
  placeholder?: string;
  help?: string;
  full?: boolean;
  id?: string;
}

export function InputField({ label, value, onChange, type = 'text', placeholder, help, full, id }: InputFieldProps) {
  return (
    <Field label={label} help={help} full={full} htmlFor={id}>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
