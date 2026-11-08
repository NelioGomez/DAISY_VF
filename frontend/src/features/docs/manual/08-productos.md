---
id: productos
titulo: Productos
grupo: Compras
modulo: productos
resumen: El catálogo maestro de repuestos y equipos — cómo crear y editar productos, fijar su precio, poner su foto y leer su ficha completa.
---

## Para qué sirve

**Productos** :ic-package: es el catálogo maestro de todo lo que NORCOR compra, fabrica y vende. Cada producto se registra **una sola vez** y desde ahí lo usan todos los módulos: compras, inventario, cotizaciones, punto de venta, producción y el sitio web.

Se abre en el menú **Compras › Productos**.

> **Importante:** En esta pantalla **no se cambian las existencias ni el costo**. Las existencias suben con las compras y la producción, bajan con las ventas, y se corrigen con ajustes de [Inventario](?cap=inventario). El costo promedio lo calcula el sistema con cada compra recibida.

## La lista de productos

![Lista de productos filtrada por categoría.](/manual/pantalla-tabla.webp)

La tabla muestra el **SKU** (código del producto), el nombre con su foto, la marca, la categoría, el **costo promedio**, el **precio** de venta, las **existencias** y el estado. Las existencias en rojo están en su mínimo o por debajo.

Puede filtrar por:

- **Categoría** y **Marca**.
- **Estado**: activos o inactivos.
- **Stock**: crítico (en o bajo el mínimo), agotado o sobre el mínimo.
- **Precio**: con precio o **sin precio comercial** (productos que todavía no se pueden vender).

Con **Columnas** puede mostrar también el código de barras, las existencias en bodega y en sucursal, y el mínimo. Las herramientas de la tabla se explican en [Conocer la pantalla](?cap=pantalla#tablas-filtros-y-columnas).

## Crear un producto

![Formulario de nuevo producto.](/manual/productos-nuevo.webp)

1. Haga clic en **+ Nuevo producto**.
2. Llene los datos:
   - **Foto del producto**: haga clic en **Subir foto** o arrastre la imagen al recuadro (JPG, PNG o WebP). El sistema la reduce sola. Con **Usar imagen del catálogo o enlace** puede escribir la dirección de una imagen ya existente. Si no pone foto, se muestra el ícono de la categoría.
   - **SKU**: el código único del producto. Acepta letras, números, punto, guion y diagonal (por ejemplo `DSP-NZL-13`).
   - **Marca** y **Categoría**: elíjalas de la lista.
   - **Nombre del producto**: como lo conoce el cliente.
   - **Código de barras** (opcional): escanéelo con el lector o escríbalo. Sirve para agregar el producto en el punto de venta con el lector.
   - **Precio de venta (C$)**: solo lo ven y lo llenan administración y gerencia. Si usted no puede fijar precios, el producto queda **sin precio** hasta que gerencia lo establezca.
   - **Unidad de medida**: cómo se cuenta la existencia, por ejemplo por unidad o, en el caso de la manguera a granel, por pie.
   - **Stock mínimo**: cuando la existencia llega a este número o baja de él, el producto se marca como **crítico**.
   - **Stock máximo (reposición)** (opcional): el reabastecimiento sugiere comprar hasta este nivel.
   - **Garantía (días)**: por ejemplo `365` = 1 año. Se muestra en el sitio web y permite registrar órdenes de servicio en garantía. Déjelo vacío si no tiene garantía.
   - **Descripción**: detalles técnicos que ayudan al cliente.
3. Haga clic en **Guardar**.

El producto nuevo empieza con existencia **0**. Para tenerlo en inventario, regístrelo en una [compra](?cap=compras) y reciba la mercadería.

> **Nota:** Las categorías y las marcas no tienen pantalla propia: si necesita una nueva, pídala al administrador del sistema.

## Editar un producto

1. En la lista, haga clic en **Editar** en la fila del producto, o abra su ficha y haga clic en **Editar**.
2. Cambie lo que necesite y haga clic en **Guardar**.

Al editar aparece además el campo **Estado**:

- **Activo**: se puede comprar, vender y cotizar.
- **Inactivo**: deja de aparecer en el punto de venta, en las cotizaciones nuevas y en el sitio web, pero conserva todo su historial.

> **Consejo:** Los productos no se borran, se **desactivan**. Así las facturas, compras y movimientos anteriores siguen mostrando el producto correcto.

## Cambiar el precio

Solo **administración** y **gerencia** pueden cambiar el precio.

![Ventana para cambiar el precio, con el historial.](/manual/productos-precio.webp)

1. Haga clic en **Precio** en la fila del producto (o en su ficha).
2. La ventana muestra el precio vigente y el costo promedio. Escriba el **Nuevo precio (C$)**. Debajo se calcula el **margen** sobre el costo, para que vea si deja ganancia.
3. Escriba el **Motivo** del cambio (por ejemplo, *nueva lista del proveedor* o *ajuste por tipo de cambio*).
4. Haga clic en **Guardar precio**.

Cada cambio queda en el **Historial**, con la fecha desde y hasta cuándo estuvo vigente, el precio, el usuario que lo cambió y el motivo.

> **Importante:** Las ventas y cotizaciones ya emitidas **conservan el precio con que se hicieron**. El precio nuevo se aplica desde ese momento en el punto de venta, en las cotizaciones nuevas y en el sitio web.

## La ficha del producto

Haga clic en cualquier producto de la lista para abrir su **ficha** en el panel lateral. Reúne todo lo que se sabe del producto.

![Ficha de un producto.](/manual/productos-ficha.webp)

1. **Etiquetas de estado**:
   - existencia: **Disponible**, **Bajo** (en o bajo el mínimo) o **Agotado**;
   - **rotación**: qué tan rápido se vende (alta, media, baja o sin movimiento en 90 días);
   - **garantía**: el plazo que tiene, o **Sin garantía**.
2. **Datos principales**:
   - **Stock**: el total y cuánto hay en bodega y en sucursal, con el mínimo y el máximo.
   - **Costo promedio**: lo que cuesta en promedio, según las compras y entradas.
   - **Precio vigente**: el precio de venta y el margen.
3. **Pestañas**: **Resumen**, **Movimientos**, **Ventas**, **Proveedores** y **Precios**. El número de cada pestaña indica cuántos registros tiene.
4. **Botones**: **⚖ Ajustar** (corregir la existencia), **Precio** y **Editar**. Solo aparecen los que su rol puede usar.

### Qué muestra cada pestaña

- **Resumen**: unidades vendidas en 30 y 90 días, consumidas en producción, **días de inventario** (para cuántos días alcanza la existencia al ritmo actual), última venta, ingresos y margen de 90 días, las compras **en camino** con su fecha de llegada, y la descripción.
- **Movimientos**: cada entrada y salida, de la más reciente a la más antigua, con la cantidad, la existencia antes y después, la ubicación, el usuario y el documento que la causó (factura, compra, traslado, ajuste, lote…). Haga clic en el documento para abrirlo.
- **Ventas**: las facturas en las que se vendió.
- **Proveedores**: quién lo vende, a qué costo y cuál es el **proveedor preferente**.
- **Precios**: el historial completo de precios.

![Pestaña Movimientos: cada entrada y salida con su documento.](/manual/productos-ficha-movimientos.webp)

## Descargar la lista

**⬇ Exportar CSV** descarga todos los productos con su SKU, nombre, marca, categoría, costo promedio, precio, existencia y mínimo, para abrirlos en Excel.
