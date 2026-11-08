---
id: dashboard
titulo: Panel e indicadores (Dashboard)
grupo: Dashboard
modulo: dashboard
resumen: La pantalla de inicio. Muestra cómo va el negocio, qué tareas esperan atención hoy y los botones para empezar el trabajo más común.
---

## Para qué sirve

El **Dashboard** es la primera pantalla que se abre al entrar al sistema. En un vistazo responde tres preguntas:

- **¿Cómo vamos?** Ventas, cobros, inventario y producción de los últimos 30 días.
- **¿Qué tengo pendiente hoy?** Una lista de tareas que llevan directo a donde se resuelven.
- **¿Qué quiero hacer?** Botones para empezar una venta, una cotización, una compra, etc.

Para abrirlo, haga clic en **Dashboard › Panel e indicadores** :ic-gauge: en el menú, o en **Inicio** en la ruta de la barra superior.

> **Nota:** Cada rol ve en el Dashboard solamente lo de su trabajo. Por ejemplo, el técnico ve sus órdenes de servicio y no ve las ventas; el encargado de inventario ve el valor del inventario en lugar de las ventas.

## Las partes del Dashboard

![El Dashboard visto por el administrador.](/manual/dashboard.webp)

1. **Acciones rápidas**: botones para empezar el trabajo más común. Solo aparecen los que su rol puede usar.
2. **Indicadores**: los números principales del negocio.
3. **Gráfico**: las ventas de cada día de las últimas dos semanas.
4. **Pendientes para hoy**: las tareas que esperan atención, cada una con su botón para resolverla.

## Acciones rápidas

| Botón | Qué hace | Atajo |
|---|---|---|
| **Nueva venta** | Abre el [punto de venta](?cap=pos) | [[Alt + V]] |
| **Nueva cotización** | Abre el formulario de [cotización](?cap=cotizaciones) | [[Alt + C]] |
| **Nueva compra** | Abre un nuevo [pedido de compra](?cap=compras) | — |
| **Orden de producción** | Abre una nueva [orden de producción](?cap=produccion) | — |
| **Registrar pago** | Abre [Pagos y CxC](?cap=pagos) para registrar un cobro | — |

## Los indicadores

| Indicador | Qué significa |
|---|---|
| **Ventas (30 días)** | Total facturado en los últimos 30 días. Debajo se compara con los 30 días anteriores: ▲ subió, ▼ bajó. |
| **Ticket promedio** | Lo que se vende en promedio por factura. |
| **Conversión de cotizaciones** | Qué porcentaje de las cotizaciones emitidas terminó en venta. |
| **Stock crítico** | Productos con existencia igual o menor a su mínimo, y cuántos están agotados. Se pone en rojo si hay alguno. |
| **Valor de inventario** | Lo que vale la mercadería en existencia, a costo promedio (lo ve quien no ve ventas). |
| **Cuentas por cobrar** | Lo que los clientes deben por facturas de crédito, cuántas facturas son y cuántas están vencidas. |
| **Órdenes OPI abiertas** | Órdenes de servicio registradas, asignadas o en proceso. |
| **Cotizaciones pendientes** | Cotizaciones que esperan respuesta del cliente y cuántas aprobadas aún no son venta. |

> **Consejo:** Todos los montos están en córdobas (C$). Las ventas anuladas no se cuentan.

## Pendientes para hoy

Cada línea dice qué falta y tiene un botón que lo lleva a la pantalla donde se resuelve. Solo aparecen los pendientes de su rol.

| Pendiente | Botón | Lo lleva a |
|---|---|---|
| Productos agotados o con stock crítico | **Reabastecer** | Reabastecimiento (o Inventario) |
| Facturas vencidas | **Cobrar** | Pagos y CxC |
| Facturas que vencen hoy o mañana | **Ver cuentas** | Pagos y CxC |
| Cotizaciones que vencen en 3 días | **Dar seguimiento** | Cotizaciones |
| Cotizaciones aprobadas sin venta | **Convertir en venta** | Cotizaciones |
| Consultas web nuevas | **Atender** | Consultas web |
| Compras atrasadas en llegar | **Revisar compras** | Pedidos de compra |
| Compras por recibir | **Registrar recepción** | Pedidos de compra |
| Órdenes de servicio sin técnico | **Asignar técnico** | Órdenes de servicio |
| Órdenes de servicio asignadas a usted | **Ver mis órdenes** | Órdenes de servicio |
| Lotes que esperan inspección de calidad | **Inspeccionar** | Producción › Lotes y calidad |
| Órdenes de producción liberadas por iniciar | **Iniciar producción** | Producción |

Cuando no hay nada pendiente, el cuadro dice **Todo al día: no hay pendientes**. Los mismos pendientes están en la campana de la barra superior, en cualquier pantalla.

## Más abajo en el Dashboard

![La parte de abajo del Dashboard: manufactura, más vendidos, antigüedad de las cuentas por cobrar, últimas ventas y stock crítico.](/manual/dashboard-abajo.webp)

- **Manufactura — últimos 30 días**: cómo va la producción del taller.
  - **Rendimiento (yield)**: de lo planificado, qué porcentaje salió bueno y entró al inventario.
  - **Tasa de no conformidad**: de lo inspeccionado, qué porcentaje salió con defectos.
  - **Tiempo de ciclo promedio**: cuánto tarda una orden desde que se inicia hasta que se termina.
  - **Lotes por inspeccionar**: lo fabricado que espera el control de calidad.
  - La barra de colores muestra lo liberado al inventario (verde), lo desechado (rojo) y lo que falta inspeccionar o está en retrabajo (amarillo). **Ir a Producción** abre el módulo.
- **Más vendidos (30 días)**: los cinco productos que más unidades vendieron. **Ver reportes** abre los reportes.
- **Antigüedad de cuentas por cobrar**: lo que se debe, separado por cuántos días lleva vencido: vigente, 1–30, 31–60, 61–90 y más de 90 días. **Ir a Pagos** abre las cuentas por cobrar.
- **Últimas ventas**: las cinco facturas más recientes con su estado.
- **Stock crítico — reabastecer**: los productos bajo su mínimo, con su existencia y su mínimo (por ejemplo `2 / 2`). **Ver sugerencias de compra** abre el reabastecimiento.

## Cuándo se actualiza

El Dashboard se actualiza solo: cuando alguien registra una venta, un pago o una recepción, los números cambian sin recargar la página (vea *En vivo* en [Conocer la pantalla](?cap=pantalla#en-vivo-cambios-de-otros-usuarios)).
