---
id: ventas
titulo: Ventas y facturación
grupo: Ventas
modulo: ventas
resumen: La lista de todas las facturas, cómo leer e imprimir una factura, sus estados de pago y cómo anular una venta cuando hubo un error.
---

## Para qué sirve

**Ventas y facturación** :ic-receipt: es el registro de todas las ventas. Cada venta genera una **factura** (`FAC`) con numeración automática; al registrarla, el sistema:

- aplica el impuesto configurado y calcula los totales;
- **descuenta el inventario**;
- si es a crédito, crea la **cuenta por cobrar**.

Se abre en el menú **Ventas › Ventas y facturación**. Las ventas nuevas se hacen en el [Punto de venta](?cap=pos) (botón **+ Nueva venta** o [[Alt + V]]) o al [convertir una cotización](?cap=cotizaciones#convertir-en-venta).

> **Nota:** Vendedores y administración registran ventas. Gerencia y contabilidad las consultan. Solo el **administrador** puede anular una venta.

## La lista de ventas

![Lista de ventas.](/manual/ventas-lista.webp)

Cada fila muestra el número de factura, la fecha, el cliente, el **método** de pago, el total, el **saldo** pendiente (en rojo si queda algo) y el estado. Con **Columnas** puede ver además el RUC, el vendedor, la cotización de origen y la fecha de vencimiento.

Puede buscar por factura, cliente, RUC o cotización, y filtrar por **Estado**, **Forma de pago**, **Vendedor** y fechas. Debajo de la tabla se muestra el **total facturado en la selección** (sin contar las anuladas): por ejemplo, filtre las fechas de un mes para saber cuánto se vendió en ese mes.

**⬇ Exportar CSV** descarga todas las ventas para abrirlas en Excel.

## Los estados de una venta

| Estado | Qué significa |
|---|---|
| **Pagada** | No debe nada. Las ventas de contado y por transferencia nacen pagadas. |
| **Pendiente** | Venta a crédito sin ningún pago todavía. |
| **Parcial** | Venta a crédito con pagos, pero todavía con saldo. |
| **Vencida** | Venta a crédito que pasó su fecha de vencimiento y todavía tiene saldo. Para verlas, filtre por *Vencidas (con saldo)*. |
| **Anulada** | Se anuló por un error. No cuenta en las ventas ni en los reportes. |

## La factura

Haga clic en una venta para abrir su factura.

![Factura de una venta a crédito con dos pagos.](/manual/ventas-factura.webp)

La factura muestra:

- el número, la fecha y la hora, y el estado;
- la **cadena de documentos**: la cotización de origen (si la hay), los **pagos** recibidos y las **salidas de inventario** que generó. Haga clic en cada uno para abrirlo;
- el cliente y su RUC;
- los productos con su cantidad, precio y subtotal;
- el subtotal, el impuesto (si aplica), el **total** y el **saldo pendiente**;
- en ventas de contado, el **efectivo recibido** y el **vuelto**;
- la lista de **pagos** con su fecha, medio y referencia;
- la forma de pago, la fecha de vencimiento (si es a crédito) y el vendedor.

Botones:

- **Imprimir**: imprime la factura sola, sin el menú ni la pantalla de fondo. En la ventana de impresión también puede elegir **Guardar como PDF** para enviarla por correo.
- **Registrar pago**: aparece si la factura tiene saldo y usted puede registrar pagos; abre [Pagos y CxC](?cap=pagos).
- **Anular venta**: solo para el administrador (vea abajo).

## Anular una venta

Anule una venta solamente cuando hubo un **error** (por ejemplo, se facturó una cantidad equivocada o al cliente equivocado) o una devolución total.

![Ventana para anular una venta.](/manual/ventas-anular.webp)

1. Abra la factura y haga clic en **Anular venta**.
2. Lea el aviso: la venta se anulará y **las unidades vuelven al inventario**.
3. Escriba el **Motivo de la anulación** (al menos 5 caracteres), por ejemplo *error en la cantidad facturada*.
4. Haga clic en **Anular venta**.

Qué pasa al anular:

- la factura queda **Anulada**, con su motivo; no se borra;
- los productos **vuelven a la sucursal**, al mismo costo con que salieron;
- el saldo queda en **cero**, así que ya no aparece en cuentas por cobrar;
- los pagos que el cliente ya había hecho quedan en el historial; si hay que devolverle dinero, se coordina aparte;
- la anulación queda registrada en la [Auditoría](?cap=auditoria).

> **Importante:** La anulación **no se puede deshacer**. Si la venta era correcta y solo faltó algo, haga una venta nueva por la diferencia en lugar de anular.

> **Nota:** Una venta que ya está enlazada a una **orden de servicio** no se puede anular.
