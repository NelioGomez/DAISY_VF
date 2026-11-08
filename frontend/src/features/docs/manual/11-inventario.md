---
id: inventario
titulo: Inventario
grupo: Compras
modulo: inventario
resumen: Cuánto hay de cada producto en la bodega y en la sucursal, cada entrada y salida, cómo trasladar mercadería, cómo corregir la existencia después de un conteo y qué productos se mueven poco.
---

## Para qué sirve

**Inventario** :ic-warehouse: muestra en todo momento **cuánto hay** de cada producto, **dónde está** (bodega o sucursal) y **cuánto vale**. También guarda la historia de cada unidad que entra o sale.

Se abre en el menú **Compras › Inventario**. El número rojo junto al nombre indica cuántos productos están en o por debajo de su mínimo.

Las existencias cambian solas con el trabajo diario:

| Qué pasa | Efecto en el inventario |
|---|---|
| Se recibe una compra | **Entrada** en la ubicación elegida (normalmente la bodega) y nuevo costo promedio. |
| Se vende | **Salida** de la sucursal; si ahí no alcanza, el resto sale de la bodega. |
| Se anula una venta | **Entrada** en la sucursal de lo que se había vendido. |
| Se inicia una orden de producción | **Salida** de los materiales, primero de la bodega. |
| Se libera un lote fabricado | **Entrada** del producto terminado en la bodega. |
| Se traslada | Salida de una ubicación y entrada en la otra; el total no cambia. |
| Se ajusta después de un conteo | Se corrige la existencia de una ubicación. |

> **Nota:** El administrador y el encargado de inventario trasladan y ajustan. Gerencia consulta el inventario y desde aquí **fija los precios**.

## La pantalla de inventario

![Inventario: existencias por ubicación.](/manual/inventario-existencias.webp)

1. **⇩ Reabastecer**: abre las sugerencias de compra; el número indica cuántos productos hay que reponer.
2. **⇄ Trasladar**: mueve mercadería entre la bodega y la sucursal.
3. **⚖ Ajuste**: corrige la existencia después de un conteo físico.
4. **Pestañas**: **Existencias**, **Movimientos**, **Traslados** y **Rotación**.

Las tarjetas de arriba muestran el **valor del inventario** (a costo promedio), las unidades y el valor en la **Bodega principal** y en la **Sucursal principal** (con cuántos productos están solo en bodega) y cuántos **productos críticos** hay.

## Existencias

Una fila por producto con lo que hay en **Bodega**, en **Sucursal**, el **Total**, el **Mínimo**, el **costo promedio**, el **precio** y el **Estado**:

- **✓ OK**: hay más que el mínimo.
- **▼ Crítico**: hay igual o menos que el mínimo.
- **✕ Agotado**: no hay.

Puede filtrar por **Categoría**, **Marca**, **Existencia** (disponible, crítico o agotado) y **Ubicación** (con o sin existencia en sucursal, con existencia en bodega). Con **Columnas** puede ver también la categoría, la marca, el máximo y el valor de cada producto. **⬇ CSV** descarga la lista.

En cada fila hay dos botones:

- **⇄**: traslada ese producto a la otra ubicación.
- **Precio**: cambia el precio de venta (solo administración y gerencia; vea [Cambiar el precio](?cap=productos#cambiar-el-precio)).

## Movimientos

![Cada entrada y salida con su documento de origen.](/manual/inventario-movimientos.webp)

La pestaña **Movimientos** es el historial de todo lo que entró y salió, del más reciente al más antiguo. Cada fila tiene la fecha y hora, el tipo (**Entrada**, **Salida** o **Ajuste**), el producto, la ubicación, la cantidad, el costo unitario, la **existencia final**, el **documento** que lo causó y el **responsable**.

El documento es un enlace: una factura (`FAC`), una recepción de compra (`REC`), un traslado (`TR`), una orden de producción (`OP`), un lote (`LOT`)… Haga clic para abrirlo y ver por qué se movió la mercadería.

Puede buscar por SKU, producto, documento o nota, y filtrar por **Tipo**, **Ubicación** y fechas.

> **Consejo:** Si una existencia no cuadra, busque el producto en **Movimientos**: verá cada entrada y salida con su responsable hasta encontrar la diferencia.

## Trasladar mercadería

Use un traslado cuando lleva mercadería de la bodega a la sucursal (o al revés). El total no cambia y el costo tampoco; solo cambia dónde está.

![Formulario para trasladar mercadería.](/manual/inventario-trasladar.webp)

1. Haga clic en **⇄ Trasladar** (o en **⇄** en la fila de un producto).
2. Elija **Desde** dónde sale. **Hacia** se llena solo con la otra ubicación.
3. Elija el **Producto**. Al lado se ve cuánto hay en el origen. Escriba la **Cantidad**.
4. Use **+ Agregar producto** para trasladar varios productos a la vez.
5. Escriba el **Motivo** (por ejemplo, *surtido semanal de la sucursal*).
6. Haga clic en **Trasladar**. El botón indica cuántas unidades se moverán.

El traslado recibe un código `TR` y queda en la pestaña **Traslados**.

![Lista de traslados.](/manual/inventario-traslados.webp)

La pestaña **Traslados** muestra cada traslado con su fecha, de dónde a dónde, los productos, las unidades, el valor y el responsable. Haga clic en uno para ver su detalle.

> **Consejo:** Las ventas toman primero de la sucursal. Mantenerla surtida evita que el sistema tenga que despachar desde la bodega.

## Ajustar la existencia

Use un ajuste cuando la existencia del sistema no coincide con lo que hay físicamente: después de un conteo, por mercadería dañada, por uso interno o por una donación.

![Formulario de ajuste de inventario.](/manual/inventario-ajuste.webp)

1. Haga clic en **⚖ Ajuste** (o en **⚖ Ajustar** en la ficha del producto).
2. Elija el **Producto** y la **Ubicación**. Debajo se ve cuánto registra hoy el sistema en ese lugar.
3. En **Existencia contada**, escriba **cuánto hay realmente**. El sistema muestra la **diferencia** (por ejemplo, *+12 u.*).
4. Elija el **Motivo**: *Conteo físico*, *Merma o daño*, *Uso interno*, *Donación o muestra*, *Corrección de registro* u *Otro*.
5. Si tiene un documento de respaldo, escríbalo en **Referencia** (acta de conteo, número de reporte…).
6. En **Detalle** explique lo que pasó. Si eligió *Otro*, el detalle es obligatorio.
7. Haga clic en **Registrar ajuste**.

> **Importante:** El ajuste **fija la existencia al número contado** y deja registrada la diferencia con su motivo y su responsable. No sirve para registrar mercadería comprada: las compras se registran al [recibir la compra](?cap=compras#recibir-la-mercaderia), que además actualiza el costo promedio.

## Rotación

![Productos clasificados por rotación.](/manual/inventario-rotacion.webp)

La pestaña **Rotación** muestra qué tan rápido se usa cada producto (ventas más consumo en producción de los últimos 90 días):

| Rotación | Qué significa |
|---|---|
| **▲ Alta** | La existencia alcanza para 30 días o menos. Se vende rápido: vigile que no se agote. |
| **◆ Media** | Alcanza de 31 a 90 días. |
| **▼ Baja** | Alcanza para más de 90 días. Hay más de lo necesario. |
| **○ Sin movimiento** | No se vendió ni se usó en 90 días. Es dinero detenido. |

Las tarjetas de arriba muestran cuántos productos hay en cada grupo y cuánto dinero representan. La tabla incluye el uso de 30 y 90 días, el uso por día, los **días de inventario** (existencia ÷ uso por día), la fecha del último uso y el valor en existencia. Puede ordenarla, por ejemplo por **Más días de inventario**, y descargarla con **⬇ CSV**.

> **Consejo:** Para los productos **sin movimiento**, considere una promoción, revisar el precio o no volver a comprarlos.
