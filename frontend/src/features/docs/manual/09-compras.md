---
id: compras
titulo: Pedidos de compra y reabastecimiento
grupo: Compras
modulo: compras
resumen: Cómo saber qué comprar, cómo hacer un pedido a un proveedor, cómo recibir la mercadería (completa o por partes) y cómo se calcula el costo.
---

## Para qué sirve

El módulo **Compras** tiene dos pantallas en el menú:

- **Pedidos de compra** :ic-clipboard-list:: las órdenes de compra (`OC`) a los proveedores y la recepción de la mercadería.
- **Reabastecimiento** :ic-refresh-cw:: la lista de lo que conviene comprar, calculada por el sistema.

Al **recibir** una compra, el sistema suma las existencias y recalcula el **costo promedio** de cada producto con el costo real, incluido el flete y los gastos. Por eso es importante registrar las compras: de ellas sale el costo de todo lo que se vende.

> **Nota:** El administrador y el encargado de inventario crean y reciben compras. Gerencia y contabilidad solo las consultan.

## La lista de compras

![Lista de pedidos de compra.](/manual/compras-lista.webp)

Arriba hay cuatro tarjetas de resumen:

- **Pendientes de recibir**: compras ordenadas que aún esperan mercadería (y cuántas llegaron a medias).
- **Comprado (30 días)**: lo comprado en el último mes, en córdobas.
- **Recibidas**: compras completas.
- **Atrasadas**: compras que pasaron su fecha de llegada esperada sin recibirse.

La tabla muestra el código, la fecha, el proveedor (con la etiqueta **Int.** si es internacional), el estado, una barra con lo **recibido** (por ejemplo *12 / 30 u.*), el total y la fecha esperada. Las compras en dólares muestran también su equivalente en córdobas.

Puede filtrar por **Estado** (incluye *Pendientes de recibir* y *Atrasadas*), **Proveedor**, **Moneda** y fechas. En cada fila, **Ver** abre el detalle y **Recibir** registra la llegada de la mercadería.

## Los estados de una compra

| Estado | Qué significa | Qué se puede hacer |
|---|---|---|
| **Borrador** | Se está preparando; el proveedor todavía no la tiene. | Editar, eliminar u ordenar. |
| **Ordenada** | Se confirmó el pedido al proveedor. Espera mercadería. | Recibir o cancelar. |
| **Parcial** | Llegó una parte; falta el resto. | Recibir lo que falta o cancelar lo pendiente. |
| **Recibida** | Llegó todo. | Solo consultar. |
| **Cancelada** | Se anuló el pedido. Se conserva para el historial. | Solo consultar. |

## Crear una compra

![Formulario de nueva compra.](/manual/compras-nueva.webp)

1. Haga clic en **+ Nueva compra**.
2. Elija el **Proveedor**.
3. Elija la **Moneda**: córdobas (C$) o dólares (US$). Si es en dólares, escriba el **Tipo de cambio** (córdobas por dólar); con él se convierte el costo a córdobas al recibir.
4. Indique la **Llegada esperada**. Si pasa esa fecha sin recibirse, la compra aparece como **atrasada**.
5. Si hay **flete, aduana u otros gastos**, escriba el total. El sistema lo reparte entre los productos según el valor de cada línea, para que el costo sea el real.
6. Agregue los productos: elija el **Producto**, la **Cantidad** y el **Costo unitario** según la factura o proforma del proveedor. Use **+ Agregar producto** para más líneas. Abajo se ven el subtotal, los gastos y el total.
7. En **Notas** puede anotar condiciones o el número de proforma del proveedor.
8. Elija cómo guardar:
   - **Guardar borrador**: la deja en preparación, para revisarla después.
   - **Guardar y ordenar**: la confirma como pedido al proveedor.

> **Consejo:** No repita un producto en dos líneas: sume las cantidades en una sola. Las cantidades deben ser números enteros.

## El detalle de una compra

![Detalle de una compra en dólares.](/manual/compras-detalle.webp)

Haga clic en el código o en **Ver** para abrir el detalle. Muestra el proveedor, quién la creó y cuándo, la fecha esperada, y por cada producto lo **pedido**, lo **recibido**, lo **pendiente**, el costo unitario y el **costo en bodega** (en córdobas, con los gastos incluidos: es el que entra al costo promedio). Abajo están el total, las notas y la lista de **recepciones** hechas.

Botones según el estado:

- **Editar**, **Eliminar borrador** y **Ordenar compra**, si está en borrador.
- **↧ Registrar recepción**, si espera mercadería.
- **Cancelar compra** o **Cancelar lo pendiente**, si espera mercadería. Pide un **motivo** de al menos 5 caracteres. Lo que ya se recibió se queda en el inventario; solo se cancela lo que falta.

## Recibir la mercadería

Cuando llega el pedido, revise físicamente lo que llegó y regístrelo:

![Registrar la recepción de una compra.](/manual/compras-recepcion.webp)

1. Abra la compra y haga clic en **↧ Registrar recepción** (o **Recibir** en la lista).
2. En **Llega ahora**, escriba cuántas unidades de cada producto llegaron. El sistema propone lo pendiente; cámbielo si llegó menos.
3. Revise las columnas de la derecha: cómo cambiará la **existencia** (por ejemplo *31 → 39*) y el **costo promedio**.
4. En **Se recibe en**, elija la **Bodega principal** (lo normal) o la **Sucursal principal**, si el proveedor entregó allí.
5. En **Notas de la recepción** puede anotar el número de factura o guía del proveedor y el estado de la mercadería.
6. Lea el resumen verde: cuántas unidades ingresan, a qué ubicación y en qué estado quedará la compra.
7. Haga clic en **Confirmar recepción**.

Si llegó todo, la compra queda **Recibida**. Si faltó algo, queda **Parcial** y puede registrar otra recepción cuando llegue el resto.

> **Importante:** Una recepción **suma existencias y cambia el costo promedio**, y no se puede deshacer desde esta pantalla. Si se equivocó en una cantidad, corríjala con un ajuste en [Inventario](?cap=inventario#ajustar-la-existencia).

## Reabastecimiento: qué comprar

![Sugerencias de reabastecimiento.](/manual/compras-reabastecimiento.webp)

Esta pantalla revisa todos los productos y sugiere cuánto pedir de los que están en o por debajo de su mínimo.

**Cómo calcula la sugerencia:** *Sugerido = objetivo − existencia − lo que ya viene en camino.* El **objetivo** es el **stock máximo** del producto; si no lo tiene, el mayor entre **2 × mínimo** y **mínimo + ventas de 30 días**.

Las tarjetas de arriba muestran cuántos productos están en stock crítico, cuántos hay que pedir, el **costo estimado** de la compra y cuántos están pospuestos.

La lista está **agrupada por proveedor preferente**. Por cada producto se ve:

- la etiqueta **✕ Agotado** o **▼ Crítico**, y **✓ En camino** si ya hay una compra pendiente;
- la existencia, el mínimo y el máximo;
- las ventas de 30 días y la **cobertura** (para cuántos días alcanza);
- lo que viene en camino y el último costo;
- la cantidad a **Pedir**, que puede cambiar.

### Crear la compra desde las sugerencias

1. Marque la casilla de los productos que quiere incluir.
2. Ajuste la cantidad en **Pedir** si hace falta.
3. Haga clic en **Crear compra** en el grupo del proveedor. El botón muestra cuántos productos lleva y el costo aproximado.
4. Se abre el formulario de **Nueva compra** ya lleno: el proveedor, los productos, las cantidades y un costo propuesto (el último que cobró ese proveedor o, si no hay, el costo promedio).
5. Revise los costos con la proforma del proveedor y guarde la compra como **borrador** o con **Guardar y ordenar**.

### Posponer una sugerencia

Si no quiere comprar un producto por ahora (por ejemplo, porque espera una lista de precios), haga clic en **Posponer**, elija por cuántos días (**3, 7, 15 o 30**) y, si quiere, el motivo. Mientras esté pospuesto no aparece en la lista. Para verlo, marque **Mostrar pospuestos**; para que vuelva antes de tiempo, haga clic en **Reactivar**.

> **Consejo:** Si un producto no tiene mínimo ni máximo, el sistema no puede calcular cuánto pedir y muestra el botón **Definir mín./máx.**, que abre el producto para completarlos. Debajo de cada producto se ve el cálculo que hizo el sistema, por ejemplo *2 × mínimo (4) − stock 2 = 2*.
