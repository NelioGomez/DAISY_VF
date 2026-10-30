/* Resumen previo a confirmar una venta (confirmación contextual, mejoras n.° 6 y 26):
   cliente, productos, total, forma de pago y advertencias de stock. No pregunta "¿está seguro?":
   informa qué va a pasar. */
import type { CondicionesPago } from '../../store/storeContext';
import { fmtDate, isoInDays, money } from '../../utils/format';
import { stockWarnings, type SummaryLine } from './stockWarnings';

interface SaleSummaryProps {
  cliente: string;
  lines: SummaryLine[];
  totals: { sub: number; iva: number; total: number };
  terms: CondicionesPago;
}

export function SaleSummary({ cliente, lines, totals, terms }: SaleSummaryProps) {
  const unidades = lines.reduce((n, l) => n + l.cant, 0);
  const warnings = stockWarnings(lines);
  const credito = terms.metodo === 'Crédito';
  const abono = terms.abonoInicial ?? 0;
  const vence = credito && terms.diasCredito ? isoInDays(terms.diasCredito) : null;

  return (
    <div className="sale-summary">
      <dl className="facts">
        <dt>Cliente</dt>
        <dd>{cliente}</dd>
        <dt>Productos</dt>
        <dd>
          {lines.length} producto(s) · {unidades} unidad(es)
        </dd>
        <dt>Total</dt>
        <dd className="mono">{money(totals.total)}</dd>
        <dt>Forma de pago</dt>
        <dd>
          {terms.metodo}
          {terms.referencia?.trim() && ` · ref. ${terms.referencia.trim()}`}
          {credito && (
            <>
              {' '}
              · {terms.diasCredito} días{vence && ` (vence ${fmtDate(vence)})`}
              {abono > 0 ? ` · abono ${money(abono)} (${terms.metodoAbono ?? 'Contado'})` : ' · sin abono'}
            </>
          )}
        </dd>
        {credito && (
          <>
            <dt>Saldo por cobrar</dt>
            <dd className="mono" style={{ color: 'var(--red)' }}>
              {money(Math.max(0, totals.total - abono))}
            </dd>
          </>
        )}
      </dl>

      <ul className="summary-lines">
        {lines.map((l) => (
          <li key={l.prod}>
            <span>
              {l.cant} × {l.nombre} <span className="mono muted-sm">{l.sku}</span>
            </span>
            <span className="mono">{money(l.sub)}</span>
          </li>
        ))}
      </ul>

      {warnings.length > 0 ? (
        <div className={`confirm-box ${warnings.some((w) => w.tipo === 'falta') ? 'is-danger' : 'is-warn'}`} role="alert">
          <b>Advertencias de inventario</b>
          <ul>
            {warnings.map((w) => (
              <li key={w.sku}>
                <span aria-hidden="true">{w.tipo === 'falta' ? '✕ ' : '▼ '}</span>
                {w.nombre} ({w.sku}): {w.texto}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="confirm-box" role="status">
          ✓ Hay existencia suficiente y ningún producto queda en nivel crítico.
        </div>
      )}
      <p className="doc-meta" style={{ marginTop: 10 }}>
        Al confirmar, el servidor genera la factura, descuenta el inventario de la sucursal{credito ? ' y crea la cuenta por cobrar' : ''}.
      </p>
    </div>
  );
}
