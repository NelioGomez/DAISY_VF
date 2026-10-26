import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag } from '../../components/tables/Tag';
import { IVA } from '../../config/business';
import { useData } from '../../store/hooks';
import { fmtDate, money } from '../../utils/format';

export function InvoiceModal({ ventaId }: { ventaId: string }) {
  const { db } = useData();
  const { close } = useModal();
  const navigate = useNavigate();
  const v = db.ventas.find((x) => x.id === ventaId);
  if (!v) return null;
  const cli = db.clientes.find((c) => c.id === v.cli);

  const irAPagos = () => {
    close();
    navigate('/app/pagos');
  };

  return (
    <Modal
      title={'Factura ' + v.factura}
      wide
      footer={
        <>
          <CancelButton label="Cerrar" />
          {v.saldo > 0 && (
            <button className="b b-amber" onClick={irAPagos}>
              Registrar pago →
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Logo variant="invoice" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
            {v.factura}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(v.fecha)}</div>
          <EstadoTag estado={v.estado} />
        </div>
      </div>

      <div className="card" style={{ background: 'var(--panel)', padding: 12, marginBottom: 14 }}>
        <b>Cliente:</b> {cli?.nombre ?? v.cliN}
        <br />
        <span className="mono" style={{ fontSize: 12 }}>
          RUC: {cli?.ruc}
        </span>{' '}
        · {cli?.dir}
      </div>

      <table style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th>Producto</th>
            <th className="num">Cant.</th>
            <th className="num">Precio</th>
            <th className="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((it, i) => (
            <tr key={it.prod + i}>
              <td>{it.prodN}</td>
              <td className="num">{it.cant}</td>
              <td className="num">{money(it.precio)}</td>
              <td className="num">{money(it.sub)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totbox">
        <div className="r">
          <span>Subtotal</span>
          <span>{money(v.sub)}</span>
        </div>
        <div className="r">
          <span>IVA ({Math.round(IVA * 100)}%)</span>
          <span>{money(v.iva)}</span>
        </div>
        <div className="r grand">
          <span>Total</span>
          <span>{money(v.total)}</span>
        </div>
        {v.saldo > 0 && (
          <div className="r" style={{ color: 'var(--red)' }}>
            <span>Saldo pendiente</span>
            <span>{money(v.saldo)}</span>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 8 }}>
        Método: {v.metodo}
        {v.vence && ' · Vence: ' + fmtDate(v.vence)} · Vendedor: @{v.vendedor}
      </div>
    </Modal>
  );
}
