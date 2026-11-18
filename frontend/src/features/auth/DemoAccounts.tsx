/* Cuentas de prueba para presentar el sistema. Solo se muestran en
   desarrollo o con VITE_DEMO_ACCOUNTS=true (ver config/security.ts). */
import { ROLES } from '../../config/navigation';
import { DEMO_PASSWORD, MOCK_USERS } from '../../services/mock/users';

interface DemoAccountsProps {
  onPick(username: string, password: string): void;
}

export function DemoAccounts({ onPick }: DemoAccountsProps) {
  return (
    <details className="auth-demo">
      <summary>Cuentas de prueba</summary>
      <p>
        Solo visibles en desarrollo. Todas usan la contraseña <code>{DEMO_PASSWORD}</code>. Elegir una completa el formulario.
      </p>
      <ul>
        {MOCK_USERS.map((u) => (
          <li key={u.username}>
            <button type="button" onClick={() => onPick(u.username, u.password)}>
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
