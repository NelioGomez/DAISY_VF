export function AccessDenied({ roleName }: { roleName: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 50 }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2 style={{ margin: '10px 0', fontFamily: 'var(--display)' }}>Acceso denegado</h2>
      <p style={{ color: 'var(--muted)' }}>Su rol ({roleName}) no tiene permisos para este módulo.</p>
    </div>
  );
}
