---
id: administracion
titulo: Panel de administración
grupo: Control
modulo:
resumen: El área aparte, solo para el administrador, donde se maneja todo lo de cada usuario (usuario, correo, rol, contraseña, sesiones y estado), las cuentas del portal de clientes, las categorías y marcas, la activación de clientes y proveedores, los datos de la empresa y la actividad de accesos y cambios.
---

## Para qué sirve

El **Panel de administración** es un área **aparte de SIVEN**, igual que el sitio público y el portal de clientes: tiene su propia barra y su propio menú, y no cambia nada de lo que ven los demás usuarios. Ahí se hace el trabajo de configuración que antes había que pedir al servidor:

- crear **usuarios** y tener el control completo de cada uno: su **usuario**, su **correo**, sus nombres, su **rol**, su **contraseña**, sus **sesiones abiertas** y si está **activo**;
- atender las **cuentas del portal** de los clientes: recuperar su acceso, cambiar su correo o crear la cuenta de un cliente que ya existe;
- consultar qué puede hacer cada **rol**;
- crear y mantener las **categorías** y **marcas** de los productos;
- **activar o desactivar** clientes y proveedores;
- llenar los **datos de la empresa** que ve el cliente en el sitio y en los documentos, y los parámetros de facturación;
- revisar la **actividad**: quién entró, quién intentó entrar y qué se cambió.

> **Importante:** Solo el **administrador** puede entrar. Si otra persona abre la dirección del panel, ve un aviso de que no tiene acceso y un botón para volver a SIVEN. Todo lo que se hace en el panel queda en la [Auditoría](?cap=auditoria).

## Cómo entrar y salir

- Desde SIVEN, haga clic en el botón **Panel de administración** :ic-user-cog: de la barra superior (solo lo ve el administrador).
- También puede escribir la dirección del sistema seguida de `/admin`. Si no ha iniciado sesión, el sistema le pide entrar y lo regresa al panel.
- Para volver a SIVEN, use el botón :ic-layout-dashboard: de la barra del panel. Para salir del todo, **Cerrar sesión** :ic-log-out:.

## Usuarios

![Panel de administración: lista de usuarios.](/manual/admin-usuarios.webp)

1. **Secciones del panel**: Usuarios, Cuentas del portal, Roles y permisos, Categorías y marcas, Clientes y proveedores, Empresa y Actividad.
2. **+ Nuevo usuario**: crea un usuario.
3. **Buscar y filtrar**: por usuario, nombre o correo, por **rol** y por **estado** (activos o inactivos).
4. **Usuario**: haga clic en él para abrir su **ficha**, con todos sus datos y su actividad.
5. **Acciones de cada usuario**: **Editar**, **Contraseña** (restablecerla) y **Desactivar** o **Activar**.
6. **Ir a SIVEN**: vuelve al sistema.

Arriba se ve cuántos usuarios hay, cuántos están activos, cuántos inactivos y cuántos **nunca han entrado** (por ejemplo, alguien a quien no se le entregó su contraseña). La tabla muestra el usuario, el nombre, el correo, el rol (con su color), la fecha del **último ingreso** y el estado. Su propia cuenta dice *usted*.

### Crear un usuario

![Formulario para crear un usuario, con la contraseña temporal ya generada.](/manual/admin-usuario-nuevo.webp)

1. Haga clic en **+ Nuevo usuario**.
2. Escriba los **Nombres** y **Apellidos**.
3. Escriba el **Usuario** con el que va a iniciar sesión, por ejemplo `mlopez`: minúsculas, números, punto o guion.
4. Escriba el **Correo**. Es importante que sea correcto: ahí le llega el código si olvida su contraseña.
5. Elija el **Rol**, que decide qué módulos verá (vea [Roles y permisos](?cap=roles)).
6. Revise la **Contraseña temporal**: el sistema ya generó una segura. Puede pedir **Otra**, escribir una propia o **Copiar** la que está. Las marcas verdes indican que cumple los requisitos.
7. Haga clic en **Crear usuario**.

Entréguele a la persona su usuario y la contraseña temporal **en privado**. Después ella puede poner una propia con **¿Olvidó su contraseña?** en el inicio de sesión.

> **Nota:** No se puede repetir un usuario ni un correo: si ya los tiene otra persona, el sistema lo dice debajo del campo.

### La ficha del usuario

![Ficha de un usuario: sus datos, sus acciones y lo que ha hecho en el sistema.](/manual/admin-ficha.webp)

Haga clic en el **usuario** (la palabra subrayada de la primera columna) para abrir su ficha. Arriba están su usuario, su correo, su rol, su estado, cuándo se creó y su último ingreso. Debajo hay dos pestañas:

- **Lo que ha hecho**: sus últimas acciones en el sistema (inicios de sesión, ventas, cambios…).
- **Cambios a su cuenta**: quién y cuándo le cambió el usuario, el correo, el rol o la contraseña, le cerró las sesiones o lo activó o desactivó.

Se muestran los 15 registros más recientes; el historial completo está en [Actividad](?cap=administracion#actividad) y en la [Auditoría](?cap=auditoria). Desde la ficha también puede **Editar**, cambiar la **Contraseña**, **Cerrar sesiones** y **Desactivar** o **Activar** al usuario.

### Editar un usuario: usuario, correo, nombres y rol

![Editar un usuario: se cambian el usuario y el correo.](/manual/admin-usuario-editar.webp)

Con **Editar** se cambia **todo** lo de la cuenta:

- el **Usuario** con el que inicia sesión (por ejemplo, si se escribió mal o la persona prefiere otro);
- el **Correo** al que le llega el código para recuperar la contraseña;
- los **Nombres** y **Apellidos**;
- el **Rol**.

Cuando cambia el usuario o el correo, el formulario le recuerda lo que va a pasar: desde que guarde, la persona entra con el **usuario nuevo** (o con su correo), y el código de recuperación llega al **correo nuevo**. Su historial (ventas, movimientos, auditoría) se conserva con el usuario nuevo. Avísele el cambio, porque su usuario anterior ya no funciona.

El nuevo rol se ve en el menú de la persona la próxima vez que inicie sesión.

> **Importante:** También puede cambiar **su propio** usuario, correo y nombres: su sesión sigue abierta y la página se recarga con sus datos nuevos. Lo que no puede cambiar es **su propio rol**, para que el sistema nunca se quede sin administrador por error.

### Restablecer una contraseña

![Restablecer la contraseña de un usuario.](/manual/admin-restablecer.webp)

Úselo cuando alguien olvidó su contraseña y no puede recuperarla por correo:

1. Haga clic en **Contraseña** en la fila del usuario (o en su ficha).
2. Revise o cambie la contraseña temporal y cópiela.
3. Haga clic en **Restablecer contraseña**.

Se cierran las sesiones que la persona tuviera abiertas. Entréguele la contraseña temporal en privado.

### Cerrar las sesiones de un usuario

En la ficha del usuario, **Cerrar sesiones** cierra todas las sesiones que tenga abiertas, en cualquier computadora o celular. Su contraseña **no cambia**: puede volver a entrar cuando quiera.

Úselo si la persona perdió su celular o dejó la sesión abierta en un equipo compartido. No se puede usar con su propia cuenta: para salir, use **Cerrar sesión** :ic-log-out:.

### Desactivar o activar un usuario

Cuando una persona deja la empresa, **desactive** su usuario en lugar de borrarlo:

- ya no puede iniciar sesión y, si tenía una sesión abierta, se cierra en su próxima acción;
- su historial (ventas, movimientos, auditoría) se conserva con su nombre.

Para que vuelva a entrar, haga clic en **Activar**. Usted no puede desactivar su propia cuenta.

## Cuentas del portal

![Cuentas del portal de clientes.](/manual/admin-portal.webp)

Aquí están las cuentas con las que los clientes entran al [portal](?cap=portal). El portal le dice al cliente que, si olvidó su contraseña, escriba a NORCOR; y si su RUC ya estaba registrado, que se comunique para **vincular** su cuenta. Las dos cosas se resuelven en esta sección.

1. **+ Nueva cuenta**: crea la cuenta del portal para un cliente que **ya existe** en SIVEN.
2. **Buscar y filtrar**: por correo, contacto, cliente o RUC; por estado (activas o inactivas) o las que **nunca han entrado**.
3. **Correo de acceso**: haga clic en él para abrir la ficha de la cuenta, con su historial (inicios de sesión, cambios de correo o de contraseña).
4. **Acciones**: **Editar**, **Contraseña** y **Desactivar** o **Activar**.

La tabla muestra el cliente con su RUC, el correo con el que entra, la persona de contacto, cuántas **solicitudes** ha enviado, su último ingreso y su estado.

### Recuperar el acceso de un cliente

Cuando un cliente escribe porque olvidó su contraseña:

1. Confirme que quien escribe es el contacto del cliente (por ejemplo, llamando al teléfono de su ficha).
2. Busque la cuenta y haga clic en **Contraseña**.
3. Copie la contraseña temporal y haga clic en **Restablecer contraseña**.
4. Entréguesela al cliente por un medio privado (WhatsApp o llamada). Después él puede cambiarla en **Mi perfil** del portal.

Se cierran las sesiones que el cliente tuviera abiertas.

### Cambiar el correo de acceso

Con **Editar** se cambian el **Correo de acceso**, la **Persona de contacto** y el **Teléfono**. Desde que guarde, el cliente entra al portal con el correo nuevo. Si la ficha del cliente tenía el mismo correo, también se actualiza.

### Crear la cuenta de un cliente que ya existe (vincular)

![Nueva cuenta del portal para un cliente que ya existe.](/manual/admin-portal-nueva.webp)

Si un cliente no pudo registrarse porque su RUC ya estaba en NORCOR, cree aquí su cuenta:

1. Haga clic en **+ Nueva cuenta**.
2. Busque el **Cliente** por nombre, RUC o contacto y elíjalo de la lista. Solo aparecen los clientes activos.
3. Revise el **Correo de acceso**, la **Persona de contacto** y el **Teléfono** (se proponen los de la ficha del cliente).
4. Revise la **Contraseña temporal** y cópiela.
5. Haga clic en **Crear cuenta** y entréguele al cliente su correo y su contraseña en privado.

La cuenta queda unida a ese cliente: en el portal verá sus solicitudes y sus cotizaciones.

> **Nota:** No se puede repetir un correo entre cuentas del portal.

### Desactivar una cuenta o cerrar sus sesiones

- **Desactivar**: el cliente ya no puede entrar al portal y su sesión abierta se cierra en su próxima acción. Sus solicitudes y cotizaciones se conservan, y NORCOR lo sigue atendiendo en SIVEN. **Activar** lo deja entrar otra vez.
- **Cerrar sesiones** (en la ficha de la cuenta): cierra las sesiones abiertas sin cambiar la contraseña.

## Roles y permisos

![Lo que puede hacer cada rol, área por área.](/manual/admin-roles.webp)

Esta sección es **de consulta**. Arriba están los seis roles con cuántos usuarios activos tiene cada uno. La tabla muestra, para cada área del sistema, si el rol **Registra** (crea y modifica), **Consulta** (solo ve) o no tiene acceso (**—**). En Ventas, el administrador aparece como *Registra y anula*.

Para cambiar lo que puede hacer una persona, **cámbiele el rol** en Usuarios. El detalle de cada rol se explica en [Roles y permisos](?cap=roles).

## Categorías y marcas

![Categorías y marcas.](/manual/admin-catalogos.webp)

Las **categorías** ordenan el catálogo (por ejemplo *Boquillas y accesorios*) y las **marcas** identifican al fabricante (por ejemplo *GILBARCO*). Las dos se usan al crear productos y como filtros en el sitio público.

- Cambie entre **Categorías** y **Marcas** con los botones de arriba.
- **+ Nueva categoría** (o **+ Nueva marca**): escriba el **Nombre** y, en las categorías, una **Descripción** opcional.
- **Editar**: cambia el nombre o la descripción.
- **Desactivar**: la categoría o marca ya no se puede elegir para productos nuevos y **sus productos dejan de verse en el sitio público**. En SIVEN los productos siguen existiendo con su historial. **Activar** la vuelve a mostrar.
- **Eliminar**: solo aparece si no tiene ningún producto. Si tiene productos, desactívela.

La columna **Productos** indica cuántos productos usan cada una.

## Clientes y proveedores

![Activar o desactivar clientes y proveedores.](/manual/admin-socios.webp)

Aquí solo se decide quién está **activo**; los datos se siguen editando en SIVEN ([Clientes](?cap=clientes) y [Proveedores](?cap=proveedores)).

- Cambie entre **Clientes** y **Proveedores** con los botones de arriba.
- Busque por nombre, RUC, contacto o correo, y filtre por estado.
- **Desactivar un cliente**: no se podrá elegir para cotizaciones, ventas ni órdenes de servicio nuevas. Sus facturas, pagos y saldo se conservan.
- **Desactivar un proveedor**: no se podrá elegir para compras nuevas. Sus compras anteriores se conservan.
- **Activar** los vuelve a dejar disponibles.

Nada se borra: así el historial siempre muestra con quién se hizo cada documento.

## Empresa

![Datos de la empresa y parámetros de facturación.](/manual/admin-empresa.webp)

**Contacto**: el nombre de la empresa, su **RUC**, el **teléfono**, el **WhatsApp** (con código de país, por ejemplo `50588880000`), el **correo**, la **dirección** y el **horario de atención**. Se muestran en la página de Contacto, en el pie del sitio y en los botones de WhatsApp del sitio.

El **RUC**, la dirección, el teléfono y el correo salen además debajo del logo en la **factura impresa** (vea [Ventas y facturación](?cap=ventas)), y el nombre con el RUC en la **cotización** que el cliente ve e imprime en el portal.

**Facturación**:

- **Régimen de impuestos**: *Cuota fija* (no se cobra IVA) o *Régimen general* (se cobra IVA). Con el régimen general aparece la **Tasa de IVA (%)**, que en Nicaragua es 15 %.
- **Plazo de crédito por omisión (días)**: el plazo que se propone al vender a crédito en el punto de venta o al convertir una cotización. Se puede cambiar en cada venta.

Los cambios se aplican a las ventas y cotizaciones **nuevas**; las ya emitidas no cambian. El botón **Guardar cambios** indica cuántos datos cambió.

> **Importante:** Confirme con contabilidad antes de cambiar el régimen de impuestos: cambia cómo se calculan las ventas desde ese momento.

## Actividad

![Actividad: accesos de los últimos días.](/manual/admin-actividad.webp)

Es de **solo lectura** y responde dos preguntas: *¿quién entró o intentó entrar?* y *¿qué se cambió en la administración?*

1. **Accesos** o **Cambios de administración**: elija qué quiere ver.
2. **Resumen de los últimos 7 días** (en Accesos): inicios de sesión, **intentos fallidos**, intentos de usuarios **inactivos** y contraseñas recuperadas por correo.
3. **Filtros**: por usuario, por tipo de evento o acción y por fechas (**Desde** y **Hasta**). Al abrir, se ven los últimos 30 días.
4. **Evento**: cada fila dice cuándo, quién, qué pasó, dónde (en SIVEN o en el portal), el detalle y desde qué dirección IP.

**Accesos** reúne los inicios y cierres de sesión, los intentos fallidos y las recuperaciones de contraseña del personal (SIVEN) y de los clientes (Portal). **Cambios de administración** reúne lo que se hizo en este panel: usuarios, cuentas del portal, datos de la empresa, categorías, marcas y la activación de clientes y proveedores; el detalle dice qué cambió, por ejemplo *usuario jflores → joshua.flores*.

> **Consejo:** Varios **intentos fallidos** seguidos con el mismo usuario pueden ser alguien que olvidó su contraseña… o alguien probando contraseñas. Hable con la persona y, si hace falta, restablézcale la contraseña o cierre sus sesiones.

Para buscar en todo lo demás del sistema (ventas, compras, inventario…), use la [Auditoría](?cap=auditoria) de SIVEN.

## En el celular

![El panel de administración en el celular.](/manual/admin-celular.webp)

El panel también funciona en el celular: las secciones se muestran como íconos debajo de la barra y la sección abierta lleva su nombre. Las tablas se deslizan hacia los lados y las fichas acomodan sus botones en dos columnas.
