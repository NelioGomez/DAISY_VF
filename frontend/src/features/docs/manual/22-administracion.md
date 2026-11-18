---
id: administracion
titulo: Panel de administración
grupo: Control
modulo:
resumen: El área aparte, solo para el administrador, donde se crean usuarios y se les asigna rol, se restablecen contraseñas, se mantienen las categorías y marcas, se activan o desactivan clientes y proveedores, y se configuran los datos de la empresa.
---

## Para qué sirve

El **Panel de administración** es un área **aparte de SIVEN**, igual que el sitio público y el portal de clientes: tiene su propia barra y su propio menú, y no cambia nada de lo que ven los demás usuarios. Ahí se hace el trabajo de configuración que antes había que pedir al servidor:

- crear **usuarios**, asignarles su **rol**, restablecer su **contraseña** y activarlos o desactivarlos;
- consultar qué puede hacer cada **rol**;
- crear y mantener las **categorías** y **marcas** de los productos;
- **activar o desactivar** clientes y proveedores;
- llenar los **datos de la empresa** que ve el cliente en el sitio y los parámetros de facturación.

> **Importante:** Solo el **administrador** puede entrar. Si otra persona abre la dirección del panel, ve un aviso de que no tiene acceso y un botón para volver a SIVEN. Todo lo que se hace en el panel queda en la [Auditoría](?cap=auditoria).

## Cómo entrar y salir

- Desde SIVEN, haga clic en el botón **Panel de administración** :ic-user-cog: de la barra superior (solo lo ve el administrador).
- También puede escribir la dirección del sistema seguida de `/admin`. Si no ha iniciado sesión, el sistema le pide entrar y lo regresa al panel.
- Para volver a SIVEN, use el botón :ic-layout-dashboard: de la barra del panel. Para salir del todo, **Cerrar sesión** :ic-log-out:.

## Usuarios

![Panel de administración: lista de usuarios.](/manual/admin-usuarios.webp)

1. **Secciones del panel**: Usuarios, Roles y permisos, Categorías y marcas, Clientes y proveedores, y Empresa.
2. **+ Nuevo usuario**: crea un usuario.
3. **Buscar y filtrar**: por usuario, nombre o correo, por **rol** y por **estado** (activos o inactivos).
4. **Acciones de cada usuario**: **Editar**, **Contraseña** (restablecerla) y **Desactivar** o **Activar**.
5. **Ir a SIVEN**: vuelve al sistema.

Arriba se ve cuántos usuarios hay, cuántos están activos y cuántos inactivos. La tabla muestra el usuario, el nombre, el correo, el rol (con su color), la fecha del **último ingreso** y el estado. Su propia cuenta dice *usted*.

### Crear un usuario

![Formulario para crear un usuario, con la contraseña temporal ya generada.](/manual/admin-usuario-nuevo.webp)

1. Haga clic en **+ Nuevo usuario**.
2. Escriba los **Nombres** y **Apellidos**.
3. Escriba el **Usuario** con el que va a iniciar sesión, por ejemplo `mlopez`: minúsculas, números, punto o guion. **No se puede cambiar después.**
4. Escriba el **Correo**. Es importante que sea correcto: ahí le llega el código si olvida su contraseña.
5. Elija el **Rol**, que decide qué módulos verá (vea [Roles y permisos](?cap=roles)).
6. Revise la **Contraseña temporal**: el sistema ya generó una segura. Puede pedir **Otra**, escribir una propia o **Copiar** la que está. Las marcas verdes indican que cumple los requisitos.
7. Haga clic en **Crear usuario**.

Entréguele a la persona su usuario y la contraseña temporal **en privado**. Después ella puede poner una propia con **¿Olvidó su contraseña?** en el inicio de sesión.

> **Nota:** No se puede repetir un usuario ni un correo: si ya existen, el sistema lo avisa.

### Editar un usuario

Con **Editar** se corrigen los nombres, el correo y el **rol**. El usuario no se cambia. Usted **no puede cambiar su propio rol**, para que el sistema nunca se quede sin administrador por error. El nuevo rol se ve en el menú de la persona la próxima vez que inicie sesión.

### Restablecer una contraseña

![Restablecer la contraseña de un usuario.](/manual/admin-restablecer.webp)

Úselo cuando alguien olvidó su contraseña y no puede recuperarla por correo:

1. Haga clic en **Contraseña** en la fila del usuario.
2. Revise o cambie la contraseña temporal y cópiela.
3. Haga clic en **Restablecer contraseña**.

Se cierran las sesiones que la persona tuviera abiertas. Entréguele la contraseña temporal en privado.

### Desactivar o activar un usuario

Cuando una persona deja la empresa, **desactive** su usuario en lugar de borrarlo:

- ya no puede iniciar sesión y, si tenía una sesión abierta, se cierra en su próxima acción;
- su historial (ventas, movimientos, auditoría) se conserva con su nombre.

Para que vuelva a entrar, haga clic en **Activar**. Usted no puede desactivar su propia cuenta.

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

**Contacto**: el nombre de la empresa, el **teléfono**, el **WhatsApp** (con código de país, por ejemplo `50588880000`), el **correo**, la **dirección** y el **horario de atención**. Se muestran en la página de Contacto, en el pie del sitio y en los botones de WhatsApp del sitio.

**Facturación**:

- **Régimen de impuestos**: *Cuota fija* (no se cobra IVA) o *Régimen general* (se cobra IVA). Con el régimen general aparece la **Tasa de IVA (%)**, que en Nicaragua es 15 %.
- **Plazo de crédito por omisión (días)**: el plazo que se propone al vender a crédito en el punto de venta o al convertir una cotización. Se puede cambiar en cada venta.

Los cambios se aplican a las ventas y cotizaciones **nuevas**; las ya emitidas no cambian. El botón **Guardar cambios** indica cuántos datos cambió.

> **Importante:** Confirme con contabilidad antes de cambiar el régimen de impuestos: cambia cómo se calculan las ventas desde ese momento.

## En el celular

![El panel de administración en el celular.](/manual/admin-celular.webp)

El panel también funciona en el celular: las secciones se muestran como íconos debajo de la barra y la sección abierta lleva su nombre. Las tablas se deslizan hacia los lados.
