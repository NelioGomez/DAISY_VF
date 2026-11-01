/* Panel de registro ↔ dirección del navegador (mejoras n.° 32 y 33).
   - Al abrir un registro se agrega ?venta=<id> (o ?producto=, ?cliente=…) sin cambiar de página.
   - Abrir un enlace con ese parámetro, recargar o usar Atrás/Adelante abre o cierra el panel.
   - Pasar de un registro a otro (p. ej. de la factura a su cotización) reemplaza la entrada del
     historial, así que Atrás o × siempre regresan a la lista. */
import { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recordStore } from '../../components/modals/recordStore';
import { useModal } from '../../components/modals/useModal';
import { parseRecordParam, recordKey, renderRecord, useRecords, withRecordParam, type RecordTipo } from './records';

interface RecordHistoryState {
  recordPushed?: boolean;
}

const splitKey = (key: string): { tipo: RecordTipo; id: string } => {
  const i = key.indexOf(':');
  return { tipo: key.slice(0, i) as RecordTipo, id: key.slice(i + 1) };
};

const historyState = (): RecordHistoryState | null =>
  ((window.history.state as { usr?: RecordHistoryState } | null)?.usr ?? null);

export function useRecordUrlSync(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const modal = useModal();
  const { canOpenRecord } = useRecords();
  const openKey = useSyncExternalStore(recordStore.subscribe, () => recordStore.get().key);

  // Al salir del sistema (cerrar sesión, inactividad) no debe quedar un panel abierto.
  useEffect(
    () => () => {
      if (recordStore.get().key) modal.close();
    },
    [modal],
  );

  // Dirección → panel.
  useEffect(() => {
    const rec = parseRecordParam(location.search);
    const current = recordStore.get().key;
    if (rec) {
      if (recordKey(rec.tipo, rec.id) === current) return;
      if (canOpenRecord(rec.tipo)) modal.open(renderRecord(rec.tipo, rec.id));
      else navigate({ pathname: location.pathname, search: withRecordParam(location.search, null) }, { replace: true });
    } else if (current) {
      modal.close();
    }
    // Solo cuando cambia la dirección (los demás valores son estables).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.pathname]);

  // Panel → dirección.
  useEffect(() => {
    const here = () => ({ pathname: window.location.pathname, search: window.location.search });
    const rec = parseRecordParam(window.location.search);
    if (openKey) {
      if (rec && recordKey(rec.tipo, rec.id) === openKey) return;
      const search = withRecordParam(window.location.search, splitKey(openKey));
      if (rec) navigate({ pathname: here().pathname, search }, { replace: true, state: historyState() });
      else navigate({ pathname: here().pathname, search }, { state: { recordPushed: true } satisfies RecordHistoryState });
      return;
    }
    if (!rec) return;
    // Se cerró el panel: se espera un instante por si otro registro lo reemplazó.
    const t = window.setTimeout(() => {
      if (recordStore.get().key || !parseRecordParam(window.location.search)) return;
      if (historyState()?.recordPushed) navigate(-1);
      else navigate({ pathname: here().pathname, search: withRecordParam(here().search, null) }, { replace: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [openKey, navigate]);
}
