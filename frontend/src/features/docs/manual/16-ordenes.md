---
id: ordenes
titulo: Órdenes de servicio (OPI)
grupo: Ventas
modulo: ordenes
resumen: Cómo registrar un trabajo de servicio técnico, asignarlo, darle seguimiento hasta completarlo, facturarlo y atender las garantías de productos y de trabajos.
---

## Para qué sirve

Una **orden de servicio** (`OPI`) registra un trabajo de servicio técnico para un cliente: una instalación, un mantenimiento, una calibración o una reparación. Con ella se sabe en todo momento **qué se pidió, quién lo está haciendo, en qué va y si se cobra o está en garantía**.

Se abre en el menú **Ventas › Órdenes de servicio** :ic-wrench:.

| Quién | Qué hace |
|---|---|
| **Administrador** | Registra las órdenes, asigna técnicos, factura y cancela. |
| **Técnico** | Ve **solo sus órdenes**: las inicia y las completa. |

## El recorrido de una orden

1. **Registrada**: se anotó el trabajo; todavía no tiene técnico.
2. **Asignada**: ya tiene técnico, que aún no empieza.
3. **En proceso**: el técnico está trabajando.
4. **Completada**: el trabajo terminó. Se anotó qué se hizo y la garantía que se da.
5. **Facturada**: se enlazó con la venta del servicio. Fin.

Una orden **en garantía** no se cobra: termina al completarse, **sin factura**. Una orden se puede **cancelar** mientras está abierta (con un motivo).

## La lista de órdenes

![Lista de órdenes de servicio.](/manual/ordenes-lista.webp)

1. **Tarjetas de resumen**: **En curso** (registradas, asignadas o en proceso), **Sin técnico** (en amarillo si hay alguna), **En garantía** y **Por facturar** (completadas con costo). Haga clic en una tarjeta para ver solo esas órdenes; otro clic quita el filtro.
2. **Búsqueda y filtros**: busque por código, cliente, descripción, técnico, factura o producto en garantía. Filtre por **Situación**, **Estado**, **Cobertura** (en garantía o con costo), **Técnico** y fechas.
3. **Acciones de cada fila**, según el estado: **Asignar**, **→ En proceso**, **→ Completada**, **Facturar** y **Cancelar**. Las cerradas muestran su factura, *Cerrada* o *Sin costo*.
4. **+ Nueva orden**: registra un trabajo nuevo.

Cada fila muestra el código (y la solicitud web de la que viene, si es el caso), la fecha y hace cuánto se registró, el cliente, el trabajo, la etiqueta azul **Garantía** si aplica, el técnico y el estado.

## Registrar una orden

1. Haga clic en **+ Nueva orden**.
2. Elija el **Cliente**.
3. Elija la **Cobertura**:
   - **Con costo**: el trabajo se cobra; se factura al terminar.
   - **En garantía**: no se cobra, porque lo cubre un producto comprado en NORCOR o un servicio anterior (vea abajo).
4. Escriba la **Descripción del servicio** (o la **Falla que reporta el cliente**, si es garantía). Sea específico: equipo, síntoma y desde cuándo.
5. Si ya sabe quién lo hará, elija el **Técnico asignado**. Puede dejarlo para después.
6. Haga clic en **Crear orden** (o **Crear orden en garantía**).

> **Consejo:** Si el cliente pidió el servicio desde el sitio web, registre la orden desde la solicitud en [Consultas web](?cap=consultas) con **Crear orden de servicio**: ya trae el cliente y la falla, y deja las dos enlazadas.

## Registrar una orden en garantía

![Nueva orden en garantía: el sistema muestra lo que el cliente compró con garantía.](/manual/ordenes-nueva-garantia.webp)

Al elegir **En garantía**, el sistema muestra lo que puede cubrirla:

- **Productos comprados**: los productos con garantía que el cliente compró en NORCOR, con la factura, la fecha, la cantidad, el plazo y **hasta cuándo** está vigente.
- **Servicios anteriores (garantía del trabajo)**: órdenes ya completadas cuya garantía de trabajo sigue vigente.

Elija la compra o el servicio que cubre la falla. Las garantías **vencidas** se ven en gris y no se pueden elegir: así se sabe por qué no aplica.

> **Nota:** Si el cliente no tiene compras ni servicios con garantía vigente, el sistema lo avisa. La garantía de cada producto se define en su ficha (**Productos › Garantía**). Si no aplica, registre la orden **con costo**.

## Asignar el técnico

1. En la fila de una orden **Registrada**, haga clic en **Asignar** (o en el detalle, **Asignar técnico**).
2. Elija el **Técnico** y confirme.

La orden pasa a **Asignada** y el técnico la ve en su lista y en su Dashboard (*órdenes asignadas a usted*). Mientras no se haya iniciado, se puede **Cambiar técnico**.

## Trabajar la orden (técnico)

1. Abra **Órdenes de servicio**: solo verá sus órdenes.
2. Cuando empiece el trabajo, haga clic en **→ En proceso** (o **Iniciar trabajo** en el detalle).
3. Al terminar, haga clic en **→ Completada** (o **Completar**).

![Completar una orden: trabajo realizado y garantía del trabajo.](/manual/ordenes-completar.webp)

4. En **Trabajo realizado**, describa lo que hizo, por ejemplo *se cambió el sello mecánico y se probó 30 minutos*. Queda en las notas de la orden.
5. En **Garantía del trabajo**, elija el plazo que NORCOR da sobre ese trabajo: *Sin garantía*, *1 mes*, *2 meses*, *3 meses (habitual)*, *6 meses* o *1 año*. Debajo se ve hasta qué fecha cubre.
6. Haga clic en **Completar orden**.

## Facturar la orden

Una orden completada **con costo** se cobra con una venta:

1. Registre primero la venta del servicio en el [Punto de venta](?cap=pos) a nombre del mismo cliente.
2. En la orden, haga clic en **Facturar**.
3. Elija la **Venta que factura el servicio** y confirme.

La orden queda **Facturada** y muestra el número de factura.

> **Nota:** Si el cliente no tiene ventas activas, el sistema avisa que primero hay que registrar la venta del servicio.

## El detalle de la orden

![Detalle de una orden en garantía, ya completada.](/manual/ordenes-detalle.webp)

1. **Avance**: los pasos por los que pasó la orden, con su fecha y el técnico.
2. **Qué cubre la garantía** (si está en garantía): el producto y la factura, o el servicio anterior, y hasta cuándo es vigente la cobertura.
3. **Garantía del trabajo realizado**: el plazo que se dio al completar, hasta cuándo es vigente y los reclamos ya atendidos con esa garantía.
4. **Reclamo en garantía**: si la falla vuelve mientras la garantía del trabajo sigue vigente, este botón crea una orden nueva **sin costo**, enlazada a la original.

En el detalle también se ven el trabajo solicitado, las notas y la cadena de documentos (solicitud web, factura).

## Cancelar una orden

Si el cliente desiste o la orden se registró por error:

1. Haga clic en **Cancelar** en la fila, o en **Cancelar orden** en el detalle.
2. Escriba el **Motivo de la cancelación** (al menos 5 caracteres) y confirme.

La orden queda **Cancelada** y se conserva en el historial. Si ya estaba completada, deja de tener garantía de trabajo.

## Dos tipos de garantía

| | Garantía del producto | Garantía del trabajo |
|---|---|---|
| Qué cubre | Un producto que el cliente compró en NORCOR | Un trabajo de servicio ya hecho |
| Plazo | Los días definidos en la ficha del producto | El que se elige al completar la orden |
| Desde | La fecha de la venta | La fecha en que se completó la orden |
| Cómo se usa | Nueva orden › **En garantía** › elegir la compra | **Reclamo en garantía** en la orden original (o Nueva orden › En garantía › elegir el servicio) |
