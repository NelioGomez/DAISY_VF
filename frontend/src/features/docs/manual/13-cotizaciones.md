---
id: cotizaciones
titulo: Cotizaciones
grupo: Ventas
modulo: cotizaciones
resumen: Cómo hacer una cotización (proforma), darle seguimiento, aprobarla o rechazarla y convertirla en venta sin volver a digitar nada.
---

## Para qué sirve

Una **cotización** (`COT`) es la propuesta de precios que se le entrega al cliente antes de venderle. En SIVEN la cotización:

- toma el **precio vigente** de cada producto y calcula los totales;
- **vale 15 días** desde que se emite;
- se puede **convertir en venta** con un clic cuando el cliente acepta, sin volver a escribir los productos;
- el cliente la puede ver desde el [portal de clientes](?cap=portal).

Se abre en el menú **Ventas › Cotizaciones** :ic-file-text:. El número rojo indica cuántas cotizaciones esperan respuesta del cliente.

## Los estados de una cotización

| Estado | Qué significa |
|---|---|
| **Borrador** | En preparación; todavía no se envió al cliente. |
| **Pendiente** | Enviada al cliente; esperando su respuesta. |
| **Aprobada** | El cliente aceptó; falta registrar la venta. |
| **Convertida** | Ya se hizo la venta. Muestra el número de factura. |
| **Rechazada** | El cliente no aceptó (se puede anotar el motivo). |
| **Vencida** | Pasaron los 15 días sin respuesta. |

## Hacer una cotización

![Formulario de nueva cotización.](/manual/cotizaciones-nueva.webp)

1. Haga clic en **+ Nueva cotización** (o presione [[Alt + C]] en cualquier pantalla).
2. Elija el **Cliente**. Si es nuevo, regístrelo primero en [Clientes](?cap=clientes).
3. Agregue los productos: elija el **Producto** y la **Cantidad**. El **precio** se llena solo con el precio vigente. Use **+ Agregar producto** para más líneas.
4. Revise el **subtotal** y el **total**. Si la empresa está en régimen de cuota fija, debajo del subtotal se indica que no lleva IVA.
5. Si quiere, escriba **Notas para el cliente** (condiciones de entrega, tiempo de validez, forma de pago…).
6. Haga clic en **Generar cotización**.

La cotización queda **Pendiente**, con su código `COT` y su fecha de vencimiento.

> **Nota:** Los precios y los impuestos definitivos los calcula el servidor al guardar, con el precio vigente en ese momento. Una cotización ya emitida **conserva sus precios** aunque después cambie el precio del producto.

> **Consejo:** Si la cotización viene de una solicitud del sitio web, no la haga desde aquí: ábrala desde [Consultas web](?cap=consultas) con **Crear cotización**, que ya trae el cliente y los productos y deja las dos enlazadas.

## La lista: tabla o pipeline

La lista de cotizaciones se puede ver de dos formas. Cambie entre ellas con los botones **Tabla** y **Pipeline**.

![Vista de tabla, con los botones de cada fila.](/manual/cotizaciones-tabla.webp)

En la **tabla**, cada fila muestra el código, la fecha de emisión, el cliente, el **origen** (*Interna* o el código de la solicitud web, por ejemplo `SOL-000004`), el total, la fecha hasta la que vale y el estado. Según el estado, la fila tiene botones:

- **Pendiente**: **Aprobar** y **Rechazar**.
- **Aprobada**: **→ Venta** y **Rechazar**.
- **Convertida**: el número de factura, que abre la venta.

Puede buscar por código, cliente o solicitud y filtrar por **Estado**, **Origen** (interna o solicitud web), **Seguimiento** (*Pendientes hace 5+ días*) y fechas de emisión.

![Vista de pipeline: una columna por estado.](/manual/cotizaciones-pipeline.webp)

El **pipeline** muestra una columna por estado, con la cantidad y el valor de cada columna. Cada cotización es una tarjeta con sus botones. Para cambiar el estado también puede **arrastrar la tarjeta** a otra columna; en el celular, arrástrela desde el ícono ⠿ de la tarjeta.

> **Consejo:** Use el filtro **Seguimiento** cada semana: muestra las cotizaciones pendientes desde hace 5 días o más, para llamar al cliente antes de que venzan. El Dashboard también avisa de las que vencen en 3 días.

## El detalle de una cotización

![Detalle de una cotización que viene de una solicitud web.](/manual/cotizaciones-detalle.webp)

Haga clic en una cotización para ver su detalle: el cliente, quién la emitió y cuándo, hasta cuándo vale, cuánto tiempo lleva en su estado y la **cadena de documentos** (por ejemplo `SOL-000004 › COT-000006`, y después la factura). Cada código abre su documento.

La tabla de productos muestra la cantidad, la existencia **disponible** hoy, el precio y el subtotal. Si no alcanza la existencia de algún producto, aparece un aviso; la existencia se vuelve a revisar al convertir en venta.

Botones según el estado:

- **Enviar al cliente** (borrador): la pasa a **Pendiente**.
- **Marcar aprobada** (pendiente).
- **→ Convertir en venta** (aprobada).
- **Rechazar** (pendiente o aprobada): puede escribir el motivo, por ejemplo *el cliente compró en otro lugar*. El motivo se muestra después en el detalle.

## Convertir en venta

Cuando el cliente acepta:

1. Haga clic en **→ Venta** en la lista, o en **→ Convertir en venta** en el detalle.
2. Revise los productos, las cantidades y la existencia disponible.
3. Elija la **forma de pago**: **Contado**, **Transferencia** o **Crédito** (vea [Formas de pago](?cap=pos#formas-de-pago)).
4. Haga clic en **Revisar y confirmar**. Se muestra el resumen de la venta.
5. Si todo está bien, haga clic en **Confirmar venta**. Para corregir la forma de pago, use **← Cambiar forma de pago**.

Se crea la factura `FAC`, la cotización queda **Convertida** y se abre la factura nueva.

> **Nota:** Una cotización **Pendiente** también se puede convertir directamente: al confirmar la venta se aprueba y se convierte en un solo paso.

> **Importante:** Si no hay existencia suficiente para toda la cotización, el sistema no deja facturar. Reciba la compra o traslade la mercadería, o haga una cotización nueva con lo que hay.
