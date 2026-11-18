import { issuedBeforePasswordChange } from '../common/utils/token-revocation';
import { passwordPolicyErrors } from './password-policy';

describe('Política de contraseña (recuperación)', () => {
  it('acepta una contraseña que cumple todo', () => {
    expect(passwordPolicyErrors('Bomba#Diesel2026', 'ngomez')).toEqual([]);
  });

  it('explica cada regla incumplida', () => {
    expect(passwordPolicyErrors('corta1!', 'x')).toContain('Debe tener entre 10 y 72 caracteres');
    expect(passwordPolicyErrors('sinmayusculas#2026', 'x')).toContain('Debe combinar mayúsculas y minúsculas');
    expect(passwordPolicyErrors('SinNumeros#Diesel', 'x')).toContain('Debe incluir al menos un número');
    expect(passwordPolicyErrors('SinSimbolo2026Abc', 'x')).toContain('Debe incluir al menos un símbolo');
    expect(passwordPolicyErrors('Ngomez#Clave2026', 'ngomez')).toContain('No debe contener su nombre de usuario');
  });

  it('rechaza más de 72 caracteres (límite de bcrypt)', () => {
    expect(passwordPolicyErrors(`Aa1#${'x'.repeat(70)}`, '')).toContain('Debe tener entre 10 y 72 caracteres');
  });
});

describe('Sesiones anteriores a un cambio de contraseña', () => {
  const changed = new Date('2026-10-27T04:00:00.500Z');
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

  it('un token emitido antes del cambio ya no vale', () => {
    expect(issuedBeforePasswordChange(sec('2026-10-27T03:59:59Z'), changed)).toBe(true);
  });

  it('el token emitido justo después (mismo segundo) sí vale', () => {
    expect(issuedBeforePasswordChange(sec('2026-10-27T04:00:00.900Z'), changed)).toBe(false);
  });

  it('con iatMs: una sesión iniciada en el mismo segundo pero ANTES del cambio ya no vale', () => {
    const changedMs = changed.getTime();
    expect(issuedBeforePasswordChange(sec('2026-10-27T04:00:00.200Z'), changed, changedMs - 300)).toBe(true);
    expect(issuedBeforePasswordChange(sec('2026-10-27T04:00:00.900Z'), changed, changedMs + 400)).toBe(false);
  });

  it('sin cambios de contraseña no se revoca nada', () => {
    expect(issuedBeforePasswordChange(sec('2020-01-01T00:00:00Z'), null)).toBe(false);
  });
});
