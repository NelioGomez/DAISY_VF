import { useToast } from '../../components/feedback/useToast';
import { useData } from '../../store/hooks';
import { exportCSV } from '../../utils/csv';

export function useExportProductos() {
  const { db } = useData();
  const toast = useToast();
  return () => {
    const file = 'productos_norcor.csv';
    exportCSV(file, [
      ['SKU', 'Nombre', 'Marca', 'Categoria', 'CostoProm', 'Precio', 'Stock', 'StockMin'],
      ...db.productos.map((p) => [p.sku, p.nombre, p.marca, p.categoria, p.costo, p.precio, p.stock, p.stockMin]),
    ]);
    toast('Exportado: ' + file, 'ok');
  };
}
