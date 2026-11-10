---
id: proveedores
titulo: Proveedores
grupo: Compras
modulo: proveedores
resumen: El registro de las empresas que le venden a NORCOR, nacionales e internacionales, con sus productos, costos y compras.
---

## Para qué sirve

**Proveedores** :ic-truck: guarda los datos de las empresas a las que NORCOR les compra: quién es el contacto, cómo comunicarse, qué productos surten, a qué costo y cuánto se les ha comprado.

Se abre en el menú **Compras › Proveedores**. Lo usan el administrador y el encargado de inventario.

![Lista de proveedores con el detalle de uno abierto.](/manual/proveedores.webp)

## La lista de proveedores

La tabla muestra el nombre, el **RUC**, el **país** (en azul si es internacional), el contacto, el teléfono y el correo. Puede buscar por nombre, RUC, país o contacto, y filtrar por **Origen** (nacionales o internacionales), **País** y **Estado** (activos o inactivos).

## Registrar un proveedor

1. Haga clic en **+ Nuevo proveedor**.
2. Escriba los datos:
   - **Nombre del proveedor**: la razón social.
   - **RUC / identificador fiscal**: el RUC en Nicaragua o el número fiscal del país del proveedor.
   - **País**: si no es Nicaragua, el proveedor se marca como **internacional**.
   - **Contacto**, **Teléfono**, **Correo** y **Dirección**.
3. Haga clic en **Guardar**.

Para corregir los datos, haga clic en **Editar** en la fila del proveedor o en su detalle.

## El detalle del proveedor

Haga clic en un proveedor para abrir su detalle en el panel lateral. Tiene tres pestañas:

- **Resumen**: cuántas **compras** se le han hecho (y cuántas faltan por recibir), el **total comprado** en córdobas (sin contar las canceladas), la fecha de la **última compra** y sus datos de contacto y origen.
- **Productos**: los productos que surte, con el código que usa el proveedor, el **último costo** que cobró, la existencia actual y la etiqueta **Preferente** si es el proveedor principal de ese producto. Haga clic en un producto para abrir su ficha.
- **Compras**: todas las órdenes de compra a ese proveedor con su estado y total. Haga clic en una para abrirla.

Abajo están los botones **Editar** y **Nueva compra**, que abre un pedido de compra con ese proveedor ya elegido.

## Cómo se asocian los productos

No hace falta asociar los productos a mano: **al recibir una compra**, el sistema anota qué proveedor surtió cada producto y a qué costo.

- El **primer proveedor** del que se recibe un producto queda como su **proveedor preferente**.
- El reabastecimiento agrupa las sugerencias por proveedor preferente, para que cada pedido salga a quien normalmente surte esos productos.
- El **último costo** se actualiza en cada recepción y se propone al crear la siguiente compra.

> **Consejo:** Los proveedores no se borran, para que sus compras se conserven en el historial. Si uno ya no surte a NORCOR, el administrador lo marca como **inactivo** en **Panel de administración › Clientes y proveedores**: dejará de ofrecerse para compras nuevas.
