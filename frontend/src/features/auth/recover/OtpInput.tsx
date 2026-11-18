/* Casillas para el código de verificación: avance automático, retroceso,
   flechas y pegado del código completo. */
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string[];
  onChange(value: string[]): void;
  onComplete?(code: string): void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function OtpInput({ value, onChange, onComplete, disabled, invalid, describedBy }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const length = value.length;

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (next: string[]) => {
    onChange(next);
    if (next.every((d) => d !== '')) onComplete?.(next.join(''));
  };

  const setAt = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      const next = [...value];
      next[i] = '';
      onChange(next);
      return;
    }
    // Si llegan varios dígitos (autocompletar del teléfono), se reparten desde esta casilla.
    const next = [...value];
    digits
      .slice(0, length - i)
      .split('')
      .forEach((d, k) => (next[i + k] = d));
    commit(next);
    focus(i + digits.length);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault();
      const next = [...value];
      next[i - 1] = '';
      onChange(next);
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length }, (_, k) => digits[k] ?? '');
    commit(next);
    focus(digits.length);
  };

  return (
    <div className={`auth-otp ${invalid ? 'has-error' : ''}`} role="group" aria-label="Código de verificación" aria-describedby={describedBy}>
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          placeholder=" "
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${length}`}
          aria-invalid={invalid}
        />
      ))}
    </div>
  );
}
