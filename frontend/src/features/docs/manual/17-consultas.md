---
id: consultas
titulo: Consultas web
grupo: Ventas
modulo: consultas
resumen: Las solicitudes que llegan desde el sitio web y el portal de clientes — cómo atenderlas según su motivo y convertirlas en cotización u orden de servicio sin volver a digitar.
---

## Para qué sirve

**Consultas web** :ic-inbox: es la bandeja de entrada de todo lo que los clientes piden por internet:

- las **listas de productos** que arman en el catálogo y envían para cotizar;
- los mensajes del **formulario de contacto** del sitio;
- las solicitudes que envían desde su cuenta del **portal de clientes**.

Cada solicitud recibe un código `SOL`. Las solicitudes **nunca se borran**: quedan como evidencia de la atención al cliente.

Se abre en el menú **Ventas › Consultas web**. El número rojo indica cuántas solicitudes **nuevas** esperan atención. Lo usan el administrador y los vendedores.

## La lista de solicitudes

![Bandeja de solicitudes web.](/manual/consultas-lista.webp)

Cada fila muestra el código, la fecha, el cliente o empresa con su contacto (y si escribió *con cuenta del portal*), el **motivo**, lo que solicita, el estado y el documento con que se atendió (la cotización o la orden de servicio, con su estado).

Puede buscar por código, cliente, contacto o producto, y filtrar por **Estado**, **Motivo**, **Origen** (portal de clientes o formulario web) y fechas.

### Los motivos

| Motivo | Qué pide el cliente | Cómo se atiende |
|---|---|---|
| **Cotización** | Precios de uno o varios productos | **Crear cotización** |
| **Servicio o garantía** | Una instalación, reparación o revisión de un equipo | **Crear orden de servicio** |
| **Cuenta del cliente** | Un cambio en sus datos o en su acceso al portal | Responderle y cerrar |
| **Reclamo** | Un problema con un pedido o un trabajo | Orden de servicio (si hay que revisar o rehacer un trabajo) o responder y cerrar |
| **Otra consulta** | Cualquier otra pregunta | Responderle y cerrar |

### Los estados

| Estado | Qué significa |
|---|---|
| **Nueva** | Acaba de llegar; nadie la ha tomado. |
| **En revisión** | Un vendedor la tomó y la está atendiendo. |
| **Cotizada** | Se creó la cotización enlazada. |
| **Cerrada** | Se atendió (con una orden de servicio o con una respuesta al cliente). |
| **Cancelada** | Era spam, estaba duplicada o tenía datos falsos. |

En el portal, el cliente ve el avance de su solicitud con palabras sencillas (*Recibida*, *En revisión*, *Cotizada*, *Atendida*).

## Atender una solicitud

![Detalle de una solicitud de cotización.](/manual/consultas-detalle.webp)

Haga clic en una solicitud para abrir su detalle. Arriba se ve quién la envió, el motivo, si vino del portal o del formulario web, cuándo llegó, el contacto y si ya está **vinculada a un cliente** registrado.

1. **Motivo**: si el cliente eligió mal el motivo (por ejemplo, escribió en *Otra consulta* pero pide precios), corríjalo aquí. Las listas de productos siempre son cotización y su motivo no se cambia.
2. **Mensaje**: lo que escribió el cliente. Si envió una lista, se ve la tabla de productos con la cantidad, la existencia **disponible**, el **precio vigente** y la observación de cada línea.
3. **Cerrar solicitud** y **Tomar (en revisión)**: cambian el estado. Tome la solicitud apenas la abra, para que sus compañeros sepan que usted la está atendiendo.
4. **Crear cotización** (o **Crear orden de servicio**, según el motivo): crea el documento con los datos de la solicitud ya cargados.

### Si pide una cotización

1. Haga clic en **Tomar (en revisión)**.
2. Haga clic en **Crear cotización**. Se abre el formulario de cotización con el cliente y los productos solicitados ya cargados. Si la solicitud no está vinculada a un cliente, elíjalo (o regístrelo primero en [Clientes](?cap=clientes)).
3. Revise las cantidades y haga clic en **Generar cotización**.

La solicitud queda **Cotizada** y enlazada a la cotización. Si el cliente tiene cuenta en el portal, la ve en **Mis cotizaciones**. Continúe en [Cotizaciones](?cap=cotizaciones).

### Si pide servicio técnico o es un reclamo

1. Tome la solicitud.
2. Si hay que revisar o rehacer un trabajo, haga clic en **Crear orden de servicio** (solo el administrador). Se precargan el cliente y la falla. Si es una garantía, márquela **En garantía** y elija la compra o el servicio que la cubre.
3. La solicitud queda **Cerrada** y enlazada a la orden. Continúe en [Órdenes de servicio](?cap=ordenes).

Si el reclamo no necesita un trabajo técnico, comuníquese con el cliente, resuelva y haga clic en **Cerrar solicitud**.

### Si es sobre su cuenta u otra consulta

![Solicitud sobre la cuenta del cliente.](/manual/consultas-cuenta.webp)

Respóndale al cliente por el contacto que dejó (correo o teléfono) y haga clic en **Cerrar solicitud**.

> **Nota:** El cliente puede cambiar él mismo su **correo de acceso** y su **contraseña** en **Mi perfil** del portal. Si pide corregir el nombre de la empresa, el RUC o la dirección, actualice su ficha en [Clientes](?cap=clientes), respóndale y cierre la solicitud.

### Si es spam o está duplicada

Haga clic en **Cancelar**. La solicitud queda **Cancelada**, pero no se borra.

> **Consejo:** Revise las consultas web al empezar el día: el Dashboard muestra cuántas hay nuevas y lleva directo a esta bandeja con **Atender**.
