/* Trazabilidad documental (mejora n.° 50): muestra la cadena de documentos relacionados
   —SOL › COT › FAC › Pago, SOL › OPI › FAC, OC › REC › Entradas, u OP › Lote › Entrada— y
   permite abrir cada uno. */
import type { TipoDocumento } from '../../types';

const DOC_LABEL: Record<TipoDocumento, string> = {
  SOLICITUD: 'Solicitud',
  COTIZACION: 'Cotización',
  VENTA: 'Factura',
  PAGO: 'Pago',
  COMPRA: 'Compra',
  RECEPCION: 'Recepción',
  MOVIMIENTO: 'Inventario',
  PRODUCCION: 'Orden de producción',
  LOTE: 'Lote',
  TRASLADO: 'Traslado',
  SERVICIO: 'Orden de servicio',
};

const DOC_ICON: Record<TipoDocumento, string> = {
  SOLICITUD: '✉',
  COTIZACION: '▥',
  VENTA: '▧',
  PAGO: '▨',
  COMPRA: '⇩',
  RECEPCION: '↧',
  MOVIMIENTO: '⇅',
  PRODUCCION: '⚙',
  LOTE: '▦',
  TRASLADO: '⇄',
  SERVICIO: '⚒',
};

interface DocChipProps {
  tipo: TipoDocumento;
  codigo: string;
  detalle?: string;
  /** Documento que se está viendo (no es un enlace). */
  actual?: boolean;
  onOpen?: () => void;
}

export function DocChip({ tipo, codigo, detalle, actual, onOpen }: DocChipProps) {
  const content = (
    <>
      <span className="doc-chip-ic" aria-hidden="true">
        {DOC_ICON[tipo]}
      </span>
      <span className="sr-only">{DOC_LABEL[tipo]} </span>
      <span className="mono">{codigo}</span>
      {detalle && <span className="doc-chip-sub">{detalle}</span>}
    </>
  );
  if (onOpen && !actual) {
    return (
      <button type="button" className="doc-chip is-link" onClick={onOpen} title={`Abrir ${DOC_LABEL[tipo].toLowerCase()} ${codigo}`}>
        {content}
      </button>
    );
  }
  return (
    <span className={`doc-chip ${actual ? 'is-current' : ''}`} aria-current={actual ? 'page' : undefined}>
      {content}
    </span>
  );
}

export interface ChainItem extends DocChipProps {
  id: string;
}

export function DocChain({ items }: { items: ChainItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="doc-chain" aria-label="Documentos relacionados">
      <ol>
        {items.map((it, i) => (
          <li key={`${it.tipo}-${it.id}`}>
            {i > 0 && (
              <span className="doc-chain-sep" aria-hidden="true">
                ›
              </span>
            )}
            <DocChip {...it} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
