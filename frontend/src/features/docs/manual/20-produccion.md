---
id: produccion
titulo: Producción
grupo: Producción
modulo: produccion
resumen: Cómo se fabrican productos en el taller — listas de materiales, rutas, órdenes de producción, lotes y control de calidad — y cómo lo fabricado entra al inventario.
---

## Para qué sirve

NORCOR también **fabrica** algunos productos en su taller, por ejemplo mangueras de 10 pies armadas con sus terminales a partir de manguera a granel. El módulo **Producción** :ic-factory: controla ese trabajo de principio a fin:

- **qué materiales** lleva cada producto y **qué pasos** se siguen para fabricarlo;
- **cuánto** se va a fabricar y para cuándo;
- los **materiales** que se consumen del inventario;
- el **control de calidad**: solo lo que pasa la inspección entra al inventario para venderse.

En el menú, **Producción** tiene cuatro pantallas: **Órdenes de producción** :ic-cog:, **Lotes y calidad** :ic-list-checks:, **Listas de materiales** :ic-layers: y **Rutas de producción** :ic-route:. También se puede cambiar entre ellas con las pestañas de la pantalla.

> **Nota:** El administrador y el encargado de inventario trabajan en producción y calidad. Gerencia solo consulta.

## El recorrido completo

1. **Lista de materiales**: qué componentes lleva una unidad del producto (se define una vez).
2. **Ruta**: los pasos para fabricarlo (se define una vez).
3. **Orden de producción** (`OP`): cuántas unidades fabricar. Pasa por **Borrador → Liberada → En proceso → Terminada**.
4. **Lote** (`LOT`): las unidades fabricadas, que quedan **por inspeccionar**.
5. **Inspección**: las unidades conformes entran al inventario de la **Bodega principal**.

## Los indicadores

Arriba de las pantallas de producción están los indicadores de los últimos 30 días:

- **Rendimiento (yield)**: de las unidades planificadas, qué porcentaje salió bueno y se liberó al inventario.
- **No conformidad**: de las unidades inspeccionadas, qué porcentaje salió con defectos.
- **Tiempo de ciclo**: cuánto tarda en promedio una orden desde que se inicia hasta que se termina.
- **Por inspeccionar**: lotes que esperan control de calidad, órdenes en proceso y órdenes por iniciar.

## Listas de materiales

![Listas de materiales.](/manual/produccion-bom.webp)

Una **lista de materiales** (también llamada BOM) dice qué componentes y cuántos lleva **una unidad** del producto terminado. Por ejemplo, una manguera de 10 pies con terminales lleva 10 pies de manguera a granel, 1 terminal macho y 1 terminal hembra.

La tabla muestra el código (`LM`) y su versión, el producto terminado, los componentes por unidad, el **costo de materiales por unidad**, el estado (**Vigente**) y en cuántas órdenes se ha usado.

### Crear una lista de materiales

1. Haga clic en **+ Nueva lista de materiales**.
2. Elija el **Producto terminado** (lo que se ensambla).
3. Agregue cada **Componente** con su **Cantidad por unidad** (números enteros). Se muestran el costo promedio de cada componente y el total de **materiales por unidad**.
4. Si quiere, escriba **Notas**.
5. Haga clic en **Guardar**.

Cada producto tiene **una sola lista vigente**. Si edita una lista que ya se usó en órdenes, el sistema crea una **versión nueva** y la anterior queda como historial; las órdenes ya creadas conservan la versión con que se hicieron. Para ver las versiones viejas, marque **Ver versiones anteriores**.

> **Nota:** El costo de la lista es una referencia con el costo promedio de hoy. El costo real se calcula al iniciar cada orden, con lo que realmente se consumió.

## Rutas de producción

![Rutas de producción.](/manual/produccion-rutas.webp)

Una **ruta** es la lista ordenada de **operaciones** para fabricar el producto, por ejemplo *10. Medición y corte*, *20. Acoplamiento de terminales* y *30. Verificación*. Cada operación tiene su **centro de trabajo** (la mesa o máquina donde se hace), sus **minutos estándar por unidad** e instrucciones.

### Crear una ruta

1. Haga clic en **+ Nueva ruta**.
2. Elija el **Producto** y escriba el **Nombre de la ruta** (por ejemplo, *Ensamble de manguera 3/4"*).
3. Agregue las **operaciones en orden**: nombre, centro de trabajo, minutos por unidad e instrucciones. Use las flechas para subir o bajar una operación.
4. Abajo se ve el **tiempo estándar por unidad** de toda la ruta.
5. Haga clic en **Guardar**.

Cada orden de producción **copia** las operaciones de la ruta como sus pasos. Editar la ruta después no cambia las órdenes ya creadas.

## Órdenes de producción

![Lista de órdenes de producción.](/manual/produccion-ordenes.webp)

La lista muestra cada orden con su código, el producto, la cantidad (producida / planificada), el **avance de la ruta** (pasos hechos), el estado, el lote de **calidad** y la fecha de entrega. Puede buscar por orden, lote o producto y filtrar por estado.

### Crear una orden

![Nueva orden de producción, con los materiales requeridos.](/manual/produccion-nueva.webp)

1. Haga clic en **+ Nueva orden de producción**.
2. Elija el **Producto a fabricar**. Solo aparecen los productos con lista de materiales vigente.
3. Escriba la **Cantidad a producir**. El sistema calcula el **costo estimado de materiales**.
4. Indique el **Inicio planificado** y la **Fecha de entrega**.
5. Revise la tabla de **materiales requeridos**: cuánto se necesita de cada componente y cuánto hay **en bodega**. Si falta algo, el sistema lo avisa.
6. Si quiere, escriba **Notas** y haga clic en **Crear orden**.

La orden queda en **Borrador**.

### Liberar e iniciar

![Orden liberada, lista para iniciar.](/manual/produccion-liberada.webp)

1. Abra la orden y haga clic en **Liberar a producción**. Queda **Liberada**: lista para empezar en el taller.
2. Cuando el taller empiece, haga clic en **▶ Iniciar producción** y confirme.

Al iniciar, el sistema **descarga los materiales del inventario** (primero de la bodega) y calcula el costo real de materiales. La orden queda **En proceso**.

> **Importante:** Si faltan materiales en bodega, la orden **no se puede iniciar**. El aviso dice qué falta, y el botón **Comprar faltantes** abre un pedido de compra con esos materiales y cantidades.

### Registrar los pasos y terminar

![Orden en proceso: cada paso de la ruta se marca al terminarlo.](/manual/produccion-en-proceso.webp)

1. En **Ruta de producción**, a medida que el taller termina cada operación, haga clic en **Marcar hecho**. Queda registrado quién y cuándo.
2. Cuando todos los pasos estén hechos, haga clic en **✓ Terminar orden**.
3. Escriba las **Unidades producidas** (como máximo, las planificadas). Se muestra el **costo por unidad** (materiales consumidos ÷ unidades producidas).
4. Si se produjo menos de lo planificado, explique por qué en **Notas** (es obligatorio).
5. Confirme.

La orden queda **Terminada** y las unidades forman un **lote** que queda **pendiente de inspección**. Todavía no entran al inventario.

### Cancelar una orden

Una orden en **Borrador** o **Liberada** se puede cancelar con **Cancelar orden** y un **motivo** (al menos 5 caracteres). Como aún no descargó materiales, el inventario no cambia. La orden queda cancelada y se conserva para la trazabilidad.

## Lotes y control de calidad

![Lotes de producción.](/manual/produccion-lotes.webp)

La pantalla **Lotes y calidad** muestra cada lote con su orden, el producto, las unidades **producidas**, **liberadas**, desechadas (**scrap**) y **por revisar**, el estado y el costo por unidad. Puede filtrar por estado: **Pendientes**, **Por inspeccionar**, **En retrabajo**, **Liberado** y **Desechado**.

### Inspeccionar un lote

![Control de calidad de un lote con una unidad no conforme.](/manual/produccion-inspeccion.webp)

1. Haga clic en **Inspeccionar** en la fila del lote (o en la orden terminada).
2. Escriba las **Unidades inspeccionadas** y cuántas salieron **No conformes** (con defecto). El sistema indica si el resultado es **CONFORME** o **NO CONFORME**.
3. Si hay no conformes, elija qué se hace con ellas:
   - **Retrabajo**: se corrigen y vuelven a inspección; mientras tanto no entran al inventario.
   - **Scrap (desecho)**: se descartan; no entran al inventario y bajan el rendimiento.
   - **Liberación por concesión**: se aceptan con el defecto documentado y entran al inventario.
4. Describa el **Defecto encontrado** (por ejemplo, *fuga en el terminal macho a 150 psi*) y, en **Notas**, la prueba realizada.
5. Revise el resumen (conformes, no conformes y cuántas **entran al inventario**) y haga clic en **Registrar inspección**.

Las unidades **conformes** (y las liberadas por concesión) entran al inventario de la **Bodega principal**, al costo de fabricación, y ya se pueden vender. Las que van a retrabajo quedan **En retrabajo** hasta que se vuelvan a inspeccionar.

El detalle de cada lote muestra cuántas unidades se liberaron, desecharon, están en retrabajo o por inspeccionar, y el historial de **inspecciones** con su resultado, disposición e inspector.

> **Consejo:** El Dashboard avisa cuando hay lotes esperando inspección (**Inspeccionar**) y órdenes liberadas por iniciar (**Iniciar producción**).
