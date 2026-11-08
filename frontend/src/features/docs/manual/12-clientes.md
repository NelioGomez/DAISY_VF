---
id: clientes
titulo: Clientes
grupo: Ventas
modulo: clientes
resumen: La cartera de clientes — cómo registrarlos y leer su perfil completo con compras, cotizaciones, solicitudes, pagos y órdenes de servicio.
---

## Para qué sirve

**Clientes** :ic-users: es la cartera comercial de NORCOR: las estaciones de servicio, talleres y empresas a las que se les cotiza y se les vende. Cada cliente tiene un **perfil completo** con todo lo que ha pasado con él.

Se abre en el menú **Ventas › Clientes**. Lo usan el administrador y los vendedores.

## La lista de clientes

![Lista de clientes.](/manual/clientes-lista.webp)

La tabla muestra el nombre, el **RUC**, el contacto, el teléfono, la ciudad, el total que ha **comprado** y su **saldo** pendiente (en rojo si debe). Puede buscar por nombre, RUC, contacto, teléfono o correo, y filtrar por:

- **Saldo**: con saldo pendiente o sin saldo.
- **Compras**: con compras o sin compras todavía.
- **Estado**: activos o inactivos.

> **Consejo:** Detenga el cursor sobre el nombre de un cliente para ver una tarjeta con su contacto, lo que ha comprado y lo que debe, sin abrir nada.

## Registrar un cliente

![Formulario de nuevo cliente.](/manual/clientes-nuevo.webp)

1. Haga clic en **+ Nuevo cliente**.
2. Escriba los datos:
   - **Nombre / razón social**: como debe salir en la factura.
   - **RUC / Cédula**: el RUC de la empresa o la cédula de la persona. No puede repetirse: si ya existe, el sistema lo avisa.
   - **Contacto**: la persona con quien se trata.
   - **Teléfono**, **Correo** y **Dirección**.
3. Haga clic en **Guardar**.

Para corregir los datos, haga clic en **Editar** en la fila del cliente o en su perfil.

> **Nota:** Los clientes también pueden registrarse solos desde el sitio web, al crear su cuenta en el [portal de clientes](?cap=portal). En ese caso aparecen aquí automáticamente, con su cuenta del portal.

También puede registrar un cliente nuevo sin salir del [punto de venta](?cap=pos), con el botón **Cliente nuevo**.

## El perfil del cliente (vista 360°)

Haga clic en un cliente para abrir su perfil en el panel lateral. Reúne en un solo lugar todo lo que ha pasado con él.

![Perfil completo de un cliente.](/manual/clientes-360.webp)

1. **Resumen de la cuenta**:
   - **Total comprado** y cuántas facturas.
   - **Saldo pendiente** y, debajo, cuánto de eso está vencido.
   - **Última compra**, con su fecha y el valor del ticket.
2. **Pestañas**:
   - **Resumen**: persona de contacto, teléfono, correo, dirección y si tiene **cuenta en el portal** (con su correo de acceso, desde cuándo y su último ingreso).
   - **Ventas**: sus facturas con su estado.
   - **Cotizaciones**: lo que se le ha cotizado.
   - **Solicitudes**: lo que ha pedido desde el sitio web o el portal.
   - **Pagos**: los pagos que ha hecho.
   - **OPI**: sus órdenes de servicio técnico.

   Cada pestaña muestra los 10 registros más recientes; haga clic en cualquiera para abrirlo.
3. **Botones**:
   - **Registrar pago**: aparece si el cliente debe y usted puede registrar pagos; abre [Pagos y CxC](?cap=pagos).
   - **Nueva cotización**: abre una cotización con este cliente ya elegido.
   - **Nueva venta**: abre el punto de venta con este cliente ya elegido.
   - **Editar**: corrige sus datos.

> **Consejo:** Antes de dar crédito a un cliente, revise su **saldo pendiente** y si tiene algo **vencido**.

## Clientes inactivos

Los clientes no se borran, para que sus facturas y pagos sigan en el historial. Un cliente **inactivo** no se puede elegir para ventas ni cotizaciones nuevas, pero su perfil se puede seguir consultando. Si necesita desactivar o reactivar un cliente, pídalo al administrador del sistema.
