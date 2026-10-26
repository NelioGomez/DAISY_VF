/* =====================================================================
   Datos semilla del prototipo (migrados sin cambios desde Index.html).
   Se usan mientras el frontend no consume la API NestJS. Cuando cada
   módulo se conecte al backend, su parte de esta semilla deja de usarse.
   ===================================================================== */
import { calcTotales } from '../../utils/documents';
import { daysAgo, iso, nowStamp } from '../../utils/format';
import type { Cotizacion, Database, EstadoVenta, LineaDocumento, MetodoPago, Producto } from '../../types';

export function createSeedDatabase(): Database {
  let seq = 1000;
  const uid = (p: string) => `${p}-${++seq}`;

  const proveedores = [
    { id: 'PRV-1', nombre: 'Gilbarco Veeder-Root', ruc: 'J0310000012345', pais: 'EE.UU.', contacto: 'Sales Dept.', tel: '+1 800 555', correo: 'sales@gilbarco.com', dir: 'Greensboro, NC' },
    { id: 'PRV-2', nombre: 'Tatsuno Centroamérica', ruc: 'J0310000067890', pais: 'Panamá', contacto: 'L. Mejía', tel: '+507 6000', correo: 'ventas@tatsuno-ca.com', dir: 'Ciudad de Panamá' },
    { id: 'PRV-3', nombre: 'Repuestos Industriales NIC', ruc: 'J0310000054321', pais: 'Nicaragua', contacto: 'R. Castro', tel: '+505 2278', correo: 'info@repinic.com.ni', dir: 'Managua' },
    { id: 'PRV-4', nombre: 'OPW Fuel Components', ruc: 'J0310000099887', pais: 'EE.UU.', contacto: 'Distrib. LATAM', tel: '+1 513 555', correo: 'latam@opwglobal.com', dir: 'Cincinnati, OH' },
  ];

  const clientes = [
    { id: 'CLI-1', nombre: 'Estación Puma Carretera Norte', ruc: 'J0310000111222', contacto: 'Ing. Pérez', tel: '+505 8855 1100', correo: 'compras@pumacn.ni', dir: 'Managua, Km 7' },
    { id: 'CLI-2', nombre: 'Servicentro UNO Las Colinas', ruc: 'J0310000333444', contacto: 'Lic. Sánchez', tel: '+505 8844 2200', correo: 'admin@unocolinas.ni', dir: 'Managua' },
    { id: 'CLI-3', nombre: 'Gasolinera Petronic León', ruc: 'J0310000555666', contacto: 'M. Rivas', tel: '+505 8833 3300', correo: 'leon@petronic.ni', dir: 'León' },
    { id: 'CLI-4', nombre: 'Taller Mantenimiento FuelTech', ruc: 'J0310000777888', contacto: 'Téc. Gómez', tel: '+505 8822 4400', correo: 'fueltech@correo.ni', dir: 'Masaya' },
    { id: 'CLI-5', nombre: 'Estación Shell Carretera Sur', ruc: 'J0310000999000', contacto: 'Ing. Mora', tel: '+505 8811 5500', correo: 'shellsur@correo.ni', dir: 'Managua' },
  ];

  const P = (sku: string, nombre: string, marca: string, categoria: string, costo: number, precio: number, stock: number, stockMin: number, ic: string): Producto => ({
    id: uid('PRD'), sku, nombre, marca, categoria, costo, precio, stock, stockMin, ic, activo: true,
  });

  const productos: Producto[] = [
    P('DSP-NZL-01', 'Boquilla automática surtidor 11A', 'OPW', 'Boquillas', 1850, 2890, 42, 15, '⛽'),
    P('DSP-HSE-02', 'Manguera de despacho 3/4" x 4m', 'Gilbarco', 'Mangueras', 980, 1620, 8, 12, '🧵'),
    P('FLT-PRT-03', 'Filtro de partículas 10 micras', 'OPW', 'Filtros', 420, 720, 60, 20, '🛢️'),
    P('ELE-DSP-04', 'Display LCD para dispensador', 'Tatsuno', 'Eléctrico', 3200, 4950, 5, 6, '📟'),
    P('PMP-SUB-05', 'Bomba sumergible turbina 1.5HP', 'Gilbarco', 'Bombas', 14500, 21800, 3, 4, '⚙️'),
    P('CON-SWV-06', 'Conector giratorio (swivel) 3/4"', 'OPW', 'Conectores', 560, 920, 28, 15, '🔩'),
    P('DSP-BRK-07', 'Break-away de seguridad', 'OPW', 'Dispensadores', 740, 1280, 2, 8, '🔌'),
    P('SEL-KIT-08', 'Kit de sellos para pistola', 'Tatsuno', 'Sellos', 180, 340, 75, 25, '🧷'),
    P('ELE-PUL-09', 'Pulser/medidor de flujo electrónico', 'Gilbarco', 'Eléctrico', 2600, 3990, 11, 8, '🔋'),
    P('FLT-WTR-10', 'Filtro separador de agua', 'OPW', 'Filtros', 650, 1080, 18, 12, '💧'),
    P('MNG-VAP-11', 'Manguera de recuperación de vapor', 'Gilbarco', 'Mangueras', 1120, 1790, 1, 6, '🌫️'),
    P('CON-ADP-12', 'Adaptador de llenado hermético', 'Tatsuno', 'Conectores', 390, 690, 33, 15, '🔗'),
  ];

  const db: Database = {
    seq,
    productos,
    clientes,
    proveedores,
    movimientos: [],
    ventas: [],
    cotizaciones: [],
    pagos: [],
    ordenes: [],
    consultas: [],
    auditoria: [],
  };

  const bySku = (sku: string) => productos.find((x) => x.sku === sku)!;
  const linea = (sku: string, cant: number): LineaDocumento => {
    const p = bySku(sku);
    return { prod: p.id, prodN: p.nombre, cant, precio: p.precio, sub: cant * p.precio };
  };

  // Movimientos de entrada iniciales (carga de inventario)
  productos.forEach((p) => {
    db.movimientos.push({ id: uid('MOV'), fecha: iso(daysAgo(40)), tipo: 'Entrada', prod: p.id, prodN: p.nombre, cant: p.stock, costo: p.costo, ref: 'Carga inicial', resp: 'ngomez' });
  });

  // Ventas históricas (para gráficos y KPIs)
  const ventaSemilla: Array<{ dias: number; cli: string; items: Array<[string, number]>; estado: EstadoVenta; metodo: MetodoPago }> = [
    { dias: 28, cli: 'CLI-1', items: [['DSP-NZL-01', 6], ['SEL-KIT-08', 10]], estado: 'Pagada', metodo: 'Contado' },
    { dias: 22, cli: 'CLI-3', items: [['FLT-PRT-03', 12], ['FLT-WTR-10', 4]], estado: 'Pagada', metodo: 'Transferencia' },
    { dias: 18, cli: 'CLI-2', items: [['ELE-DSP-04', 1], ['ELE-PUL-09', 2]], estado: 'Parcial', metodo: 'Crédito' },
    { dias: 12, cli: 'CLI-5', items: [['CON-SWV-06', 8], ['CON-ADP-12', 6]], estado: 'Pagada', metodo: 'Contado' },
    { dias: 7, cli: 'CLI-1', items: [['DSP-HSE-02', 3], ['MNG-VAP-11', 1]], estado: 'Pendiente', metodo: 'Crédito' },
    { dias: 3, cli: 'CLI-4', items: [['FLT-PRT-03', 8], ['SEL-KIT-08', 15]], estado: 'Pagada', metodo: 'Contado' },
    { dias: 1, cli: 'CLI-3', items: [['PMP-SUB-05', 1]], estado: 'Pendiente', metodo: 'Crédito' },
  ];

  ventaSemilla.forEach((v, i) => {
    const items = v.items.map(([sku, c]) => linea(sku, c));
    const t = calcTotales(items.reduce((a, b) => a + b.sub, 0));
    const cli = clientes.find((c) => c.id === v.cli)!;
    const fecha = iso(daysAgo(v.dias));
    const saldo = v.estado === 'Pagada' ? 0 : v.estado === 'Parcial' ? t.total * 0.5 : t.total;
    const venta = {
      id: uid('VTA'), factura: 'FAC-' + (2401 + i), fecha, cli: cli.id, cliN: cli.nombre, vendedor: 'jflores',
      items, ...t, metodo: v.metodo, estado: v.estado, saldo,
      vence: v.metodo === 'Crédito' ? iso(daysAgo(v.dias - 15)) : null,
    };
    db.ventas.push(venta);
    if (v.estado === 'Pagada') db.pagos.push({ id: uid('PAG'), fecha, venta: venta.id, factura: venta.factura, monto: t.total, metodo: v.metodo });
    if (v.estado === 'Parcial') db.pagos.push({ id: uid('PAG'), fecha, venta: venta.id, factura: venta.factura, monto: t.total * 0.5, metodo: v.metodo });
  });

  // Cotizaciones
  const cotSemilla: Array<[string, Array<[string, number]>, Cotizacion['estado']]> = [
    ['CLI-2', [['ELE-DSP-04', 2], ['PMP-SUB-05', 1]], 'Pendiente'],
    ['CLI-4', [['FLT-PRT-03', 20]], 'Aprobada'],
  ];
  cotSemilla.forEach(([cliId, its, estado], i) => {
    const items = its.map(([sku, q]) => linea(sku, q));
    const t = calcTotales(items.reduce((a, b) => a + b.sub, 0));
    const cli = clientes.find((x) => x.id === cliId)!;
    db.cotizaciones.push({ id: uid('COT'), codigo: 'COT-' + (501 + i), fecha: iso(daysAgo(5 - i)), cli: cli.id, cliN: cli.nombre, items, ...t, validez: '15 días', estado, vendedor: 'jflores' });
  });

  // Órdenes de servicio (OPI)
  db.ordenes = [
    { id: uid('OPI'), codigo: 'OPI-301', fecha: iso(daysAgo(6)), cli: 'Estación Puma Carretera Norte', desc: 'Reemplazo de break-away y calibración de surtidor #3', tecnico: 'Téc. López', estado: 'En proceso' },
    { id: uid('OPI'), codigo: 'OPI-302', fecha: iso(daysAgo(3)), cli: 'Servicentro UNO Las Colinas', desc: 'Diagnóstico de display LCD intermitente', tecnico: 'Téc. Ruiz', estado: 'Asignada' },
    { id: uid('OPI'), codigo: 'OPI-303', fecha: iso(daysAgo(1)), cli: 'Gasolinera Petronic León', desc: 'Instalación de bomba sumergible nueva', tecnico: '—', estado: 'Registrada' },
  ];

  // Consultas web
  db.consultas = [
    { id: uid('CON'), fecha: iso(daysAgo(2)), nombre: 'Estación Texaco Granada', contacto: '+505 8800 9090', msg: 'Necesito cotización de 4 boquillas automáticas y mangueras.', estado: 'Nueva' },
  ];

  db.auditoria.unshift({ id: uid('LOG'), fecha: nowStamp(), usuario: 'sistema', modulo: 'Sistema', detalle: 'Inicialización de datos semilla del prototipo' });

  db.seq = seq;
  return db;
}
