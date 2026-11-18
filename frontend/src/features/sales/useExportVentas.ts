import { useToast } from '../../components/feedback/useToast';
import { useData } from '../../store/hooks';
import { exportCSV } from '../../utils/csv';

export function useExportVentas() {
  const { db, registrarAuditoria } = useData();
  const toast = useToast();
  return () => {
    const file = 'ventas_norcor.csv';
    exportCSV(file, [
      ['Factura', 'Fecha', 'Cliente', 'Metodo', 'Subtotal', 'IVA', 'Total', 'Saldo', 'Estado'],
      ...db.ventas.map((v) => [v.factura, v.fecha, v.cliN, v.metodo, v.sub, v.iva, v.total, v.saldo, v.estado]),
    ]);
    toast('Exportado: ' + file, 'ok');
    registrarAuditoria('Reportes', 'Exportación CSV — ' + file);
  };
}
