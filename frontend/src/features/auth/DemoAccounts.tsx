/* Cuentas de la semilla de demostración del backend (scripts/seed-demo.mjs).
   Solo se muestran en desarrollo o con VITE_DEMO_ACCOUNTS=true. */
import { ROLES } from '../../config/navigation';
import type { RoleKey } from '../../types';

export const DEMO_PASSWORD = 'Siven2026demo';

const DEMO_USERS: Array<{ username: string; role: RoleKey; password: string | null }> = [
  { username: 'admin', role: 'admin', password: null },
  { username: 'gerencia', role: 'gerencia', password: DEMO_PASSWORD },
  { username: 'jflores', role: 'vendedor', password: DEMO_PASSWORD },
  { username: 'ngomez', role: 'inventario', password: DEMO_PASSWORD },
  { username: 'eurcuyo', role: 'contabilidad', password: DEMO_PASSWORD },
  { username: 'joporta', role: 'tecnico', password: DEMO_PASSWORD },
];

interface DemoAccountsProps {
  onPick(username: string, password: string): void;
}

export function DemoAccounts({ onPick }: DemoAccountsProps) {
  return (
    <details className="auth-demo">
      <summary>Cuentas de prueba</summary>
      <p>
        Usuarios de la semilla de demostración del backend. Contraseña <code>{DEMO_PASSWORD}</code>; el administrador usa la de{' '}
        <code>SEED_ADMIN_PASSWORD</code> en el <code>.env</code> del backend.
      </p>
      <ul>
        {DEMO_USERS.map((u) => (
          <li key={u.username}>
            <button type="button" onClick={() => onPick(u.username, u.password ?? '')}>
              <span className="auth-demo-dot" style={{ background: ROLES[u.role].color }} aria-hidden="true" />
              <span className="auth-demo-role">{ROLES[u.role].name}</span>
              <span className="auth-demo-user">{u.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
