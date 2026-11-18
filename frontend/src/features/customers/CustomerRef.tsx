/* Nombre de cliente con vista previa rápida (mejora n.° 34): contacto, total comprado y saldo,
   tomados de los datos ya cargados. */
import type { ReactNode } from 'react';
import { HoverPreview } from '../../components/preview/HoverPreview';
import { useData } from '../../store/hooks';
import { money } from '../../utils/format';

export function CustomerRef({ id, children }: { id: string; children: ReactNode }) {
  const { db } = useData();
  const c = db.clientes.find((x) => x.id === id);
  if (!c) return <>{children}</>;
  return (
    <HoverPreview
      render={() => (
        <div className="hp-body">
          <b className="hp-title">{c.nombre}</b>
          {c.ruc && <small className="mono">{c.ruc}</small>}
          <small>{[c.contacto, c.tel].filter(Boolean).join(' · ') || 'Sin contacto registrado'}</small>
          {c.correo && <small>{c.correo}</small>}
          <div className="hp-facts">
            <span>
              Total comprado <b>{money(c.totalCompras)}</b>
            </span>
            <span>
              Saldo pendiente <b className={c.saldo > 0 ? 'txt-red' : ''}>{money(c.saldo)}</b>
            </span>
          </div>
          {!c.activo && <small className="muted-sm">Cliente inactivo</small>}
        </div>
      )}
    >
      {children}
    </HoverPreview>
  );
}
