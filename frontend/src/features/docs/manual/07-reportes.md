---
id: reportes
titulo: Reportes y KPIs
grupo: Dashboard
modulo: reportes
resumen: Los indicadores de ventas, margen, cobros e inventario para tomar decisiones, y cómo descargar la información a Excel.
---

## Para qué sirve

**Reportes y KPIs** :ic-chart-column: reúne los números que gerencia y contabilidad necesitan para tomar decisiones: cuánto se ha vendido, cuánto se gana, cuánto se debe, qué se vende más y qué hay que reponer. Todos los cálculos los hace el sistema con los datos reales; no hay que sumar nada a mano.

Se abre en el menú **Dashboard › Reportes y KPIs**.

![La pantalla de reportes completa.](/manual/reportes.webp)

## Los indicadores de arriba

| Indicador | Qué significa |
|---|---|
| **Ventas acumuladas** | Todo lo facturado desde que se usa el sistema (sin ventas anuladas) y cuántas facturas son. |
| **Margen bruto** | Lo que queda de las ventas después de restar lo que costó la mercadería vendida, a costo promedio. Es la ganancia antes de gastos. |
| **Cuentas por cobrar** | Lo que deben los clientes y, debajo, cuánto de eso ya está vencido. |
| **Valor de inventario** | Lo que vale la mercadería en existencia, a costo promedio, y cuántos productos activos hay. |

Si su rol no ve las cuentas por cobrar o el inventario, en su lugar aparecen **Ventas (30 días)** o **Facturas emitidas**.

## Los gráficos y tablas

- **Ventas por día (14 días)**: cuánto se vendió cada día de las últimas dos semanas. Sirve para ver si las ventas suben o bajan y qué días se vende más.
- **Productos más vendidos (unid.)**: los productos que más unidades vendieron. Sirve para no quedarse sin ellos.
- **Ventas por método de pago**: cuánto se vendió de contado, por transferencia y a crédito, en córdobas y en porcentaje. Si el crédito crece mucho, hay más dinero en la calle por cobrar.
- **Inventario crítico (reabastecer)**: los productos que están en o por debajo de su mínimo, con su existencia y su mínimo.

## KPIs de monitoreo del sistema

La tabla de abajo lista los indicadores que se acordaron para vigilar el sistema y el negocio, con su meta:

| Código | Indicador | Meta | Tipo |
|---|---|---|---|
| KPI-01 | Tiempo de respuesta | menos de 2 segundos | Técnico |
| KPI-02 | Disponibilidad mensual | 99 % o más | Técnico |
| KPI-04 | Respaldos (backups) exitosos | 100 % | Técnico |
| KPI-06 | Ventas mensuales | Crecimiento | Comercial |
| KPI-07 | Margen por categoría | Monitorear | Financiero |
| KPI-08 | Cuentas por cobrar vencidas | Reducir | Financiero |

## Descargar a Excel

Arriba a la derecha hay dos botones de descarga:

- **⬇ Ventas**: descarga todas las facturas con su fecha, cliente, forma de pago, subtotal, IVA, total, saldo y estado.
- **⬇ Inventario**: descarga todos los productos con su SKU, marca, categoría, costo promedio, precio, existencia y mínimo.

Los archivos se descargan en formato **CSV**, que se abre con Excel o con Google Sheets. Allí puede ordenarlos, filtrarlos o hacer tablas dinámicas.

> **Nota:** El archivo ya viene preparado para que Excel muestre bien las tildes y la ñ. Los montos están en córdobas y sin símbolo de moneda, para que se puedan sumar.

## Diferencia con el Dashboard

| | Dashboard | Reportes y KPIs |
|---|---|---|
| Para qué | El trabajo del día | Analizar y decidir |
| Periodo | Últimos 30 días | Acumulado, 14 días y existencias actuales |
| Tiene | Pendientes y botones de acción | Margen, ventas por método de pago, KPIs y descargas |
| Lo usan | Todos los roles | Administrador, gerencia y contabilidad |

Para ver las ventas de un periodo exacto (por ejemplo, un mes), use los filtros de fecha de [Ventas y facturación](?cap=ventas); para los pagos de un periodo, el **Historial de pagos** de [Pagos y CxC](?cap=pagos).
