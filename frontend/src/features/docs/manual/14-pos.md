---
id: pos
titulo: Punto de venta
grupo: Ventas
modulo: ventas
resumen: Cómo vender en mostrador — buscar o escanear productos, elegir el cliente y la forma de pago (contado, transferencia o crédito), calcular el vuelto y confirmar la factura.
---

## Para qué sirve

El **Punto de venta** :ic-scan-barcode: es la pantalla para vender rápido, con el cliente presente. En una sola pantalla se agregan los productos, se elige el cliente y la forma de pago, y se genera la factura.

Para abrirlo:

- en el menú, **Ventas › Punto de venta**;
- desde cualquier pantalla, con [[Alt + V]];
- desde el Dashboard, con **Nueva venta**;
- desde el perfil de un cliente, con **Nueva venta** (el cliente ya queda elegido).

Lo usan el administrador y los vendedores.

## Las partes del punto de venta

![El punto de venta con dos productos en el carrito.](/manual/pos.webp)

1. **Buscar o escanear**: escriba el nombre, el SKU o la marca, o escanee el código de barras.
2. **Categorías**: muestran solo los productos de una categoría.
3. **Resultados**: cada producto con su precio y cuántas unidades hay disponibles. Haga clic en uno para agregarlo.
4. **Carrito**: los productos de la venta, con su cantidad y su subtotal.
5. **Cliente**: a quién se le vende.
6. **Forma de pago**: contado, transferencia o crédito.
7. **Cobrar**: revisa y confirma la venta.

> **Nota:** En el punto de venta solo aparecen los productos **activos y con precio**. Si busca un producto y no aparece, revise en [Productos](?cap=productos) que esté activo y que gerencia le haya puesto precio.

## Vender paso a paso

1. **Agregue los productos.**
   - Con el **lector de código de barras**: escanee el producto y se agrega solo; la casilla queda lista para el siguiente.
   - **Buscando**: escriba parte del nombre, SKU o marca. Muévase por los resultados con [[↑]] [[↓]] y presione [[Enter]] para agregar una unidad, o haga clic en el producto.
   - Cada vez que agrega el mismo producto, su cantidad sube en uno.
2. **Ajuste las cantidades** en el carrito con **−** y **+**, o escriba el número. La **×** quita el producto. Debajo de cada producto se ve su precio y cuánto hay disponible.
3. **Elija el cliente** en la lista **Cliente** (o presione [[F4]]). Si es un cliente nuevo, haga clic en **+ Cliente nuevo**, regístrelo y queda elegido. Si el cliente tiene saldo pendiente, el sistema lo muestra debajo.
4. **Elija la forma de pago** (vea abajo).
5. Haga clic en **Cobrar** (o presione [[F9]]).
6. Revise el **resumen**: cliente, productos, total, forma de pago y avisos de inventario.
7. Haga clic en **Confirmar venta**. Para corregir algo, use **Volver al carrito**.

Al confirmar se genera la factura `FAC`, se descuenta el inventario, el carrito queda vacío para la siguiente venta y se abre la **factura**, lista para imprimir (vea [La factura](?cap=ventas#la-factura)).

![Resumen antes de confirmar la venta.](/manual/pos-confirmar.webp)

### Atajos del punto de venta

| Tecla | Qué hace |
|---|---|
| [[F2]] | Va a la casilla de búsqueda |
| [[↑]] [[↓]] | Se mueve por los resultados |
| [[Enter]] | Agrega una unidad del producto marcado |
| [[Esc]] | Limpia la búsqueda |
| [[F4]] | Va a la lista de clientes |
| [[F9]] | Cobrar |

## Formas de pago

| Forma | Cuándo usarla | Qué pide |
|---|---|---|
| **Contado** | El cliente paga todo en efectivo ahora. | **Efectivo recibido** (opcional), para calcular el vuelto. |
| **Transferencia** | El cliente paga todo por transferencia o depósito bancario. | **Referencia** de la transferencia (obligatoria), por ejemplo `TRF-BANPRO-88213`. |
| **Crédito** | El cliente paga después. | **Plazo** en días y, si quiere, un **abono inicial**. |

### Contado y vuelto

Escriba en **Efectivo recibido** cuánto le entregó el cliente; el sistema calcula el **Vuelto**. Si el monto no alcanza, en lugar del vuelto dice **Falta**. El botón **Monto exacto** llena el campo con el total.

### Venta a crédito

![Datos de una venta a crédito.](/manual/pos-credito.webp)

1. Elija **Crédito**.
2. Escriba el **Plazo de crédito (días)**, entre 1 y 365. Debajo se ve la fecha en que vence.
3. Si el cliente da un adelanto, escriba el **Abono inicial (C$)** y elija con qué lo pagó (**Contado** o **Transferencia**; si es transferencia, escriba la referencia). Debajo se ve el **saldo a crédito**.

La factura queda con saldo pendiente y aparece en [Pagos y CxC](?cap=pagos) para que contabilidad registre los pagos.

> **Consejo:** Si el cliente paga todo de una vez, no use crédito con un abono igual al total: elija **Contado** o **Transferencia**.

## Avisos de inventario

Antes de confirmar, el resumen revisa las existencias:

- en **verde**, *Hay existencia suficiente y ningún producto queda en nivel crítico*;
- en **amarillo**, si con esta venta un producto **queda agotado** o **queda en nivel crítico** (en o bajo su mínimo). La venta se puede hacer, pero conviene avisar para reponer;
- en **rojo**, si **no hay suficiente** de algún producto. La venta no se puede confirmar hasta corregir la cantidad.

La venta descuenta primero de la **sucursal** y, si ahí no alcanza, el resto sale de la **bodega**.

## Otros detalles

- El **total** se calcula con el precio vigente. Si la empresa está en régimen de cuota fija, debajo del subtotal se indica que no lleva IVA.
- **Vaciar** quita todos los productos del carrito.
- Si cambia de pantalla o la venta falla, el carrito **se conserva**: al volver al punto de venta sigue ahí.
- **← Ventas** lleva a la lista de [Ventas y facturación](?cap=ventas).
