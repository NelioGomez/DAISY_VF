---
id: flujos
titulo: Cómo se conecta todo
grupo: Primeros pasos
modulo:
resumen: Los recorridos completos del negocio — de la compra al inventario, de la consulta a la venta y al cobro, de la producción al lote liberado y del reclamo a la garantía — y qué módulo interviene en cada paso.
---

## La idea general

En SIVEN los módulos no trabajan solos: cada documento nace de otro y alimenta al siguiente. Por eso casi nunca hay que escribir dos veces lo mismo.

- Lo que se **compra** suma existencias y actualiza el costo.
- Lo que se **vende** descuenta existencias y, si es a crédito, crea una **cuenta por cobrar**.
- Lo que se **cobra** baja el saldo del cliente.
- Lo que se **fabrica** consume materiales y, al aprobarse, entra como producto terminado.
- Todo queda en la **Auditoría** y se resume en el **Dashboard** y los **Reportes**.

Cada documento tiene un **código** que lo identifica en todo el sistema:

| Código | Documento | Dónde se ve |
|---|---|---|
| `SOL-000001` | Solicitud que llega desde el sitio web o el portal | [Consultas web](?cap=consultas) |
| `COT-000001` | Cotización | [Cotizaciones](?cap=cotizaciones) |
| `FAC-000001` | Factura de venta | [Ventas y facturación](?cap=ventas) |
| `OC-000001` | Orden (pedido) de compra | [Pedidos de compra](?cap=compras) |
| `TR-000001` | Traslado entre bodega y sucursal | [Inventario](?cap=inventario) |
| `OP-000001` | Orden de producción | [Producción](?cap=produccion) |
| `LOT-000001` | Lote fabricado | [Producción](?cap=produccion) |
| `OPI-000001` | Orden de servicio técnico | [Órdenes de servicio](?cap=ordenes) |

## Dónde está la mercadería

NORCOR tiene dos ubicaciones, y el sistema lleva las existencias de cada una por separado:

- **Bodega principal**: donde normalmente se recibe lo comprado, se guarda lo fabricado y se toman los materiales para producir.
- **Sucursal principal**: el punto de venta, de donde sale lo que se vende.

La existencia **total** de un producto es la suma de las dos. Al vender, el sistema descuenta primero de la sucursal y, si no alcanza, de la bodega. Si entre las dos no alcanza, no deja vender.

## De la compra al inventario

1. **Reabastecimiento** sugiere qué productos pedir, según la existencia mínima y máxima de cada uno y lo que ya viene en camino.
2. Se crea un **pedido de compra** (`OC`) al proveedor. Primero queda como **Borrador**; al confirmarlo pasa a **Ordenada**.
3. Cuando llega la mercadería se registra la **recepción**, en la bodega o en la sucursal. Puede recibirse completa o por partes.
4. Al recibir, **suben las existencias** y el sistema recalcula el **costo promedio** de cada producto.
5. Si hace falta, se hace un **traslado** (`TR`) de la bodega a la sucursal para tenerlo a la venta.

Capítulos: [Pedidos de compra y reabastecimiento](?cap=compras), [Proveedores](?cap=proveedores), [Inventario](?cap=inventario).

## De la consulta del cliente a la venta

1. El cliente ve el catálogo en el **sitio web**, arma su **lista** y la envía (con su cuenta del portal o con el formulario de contacto).
2. La solicitud llega a **Consultas web** como `SOL`, con estado **Nueva**, y el número rojo del menú avisa.
3. El vendedor la **toma** (queda **En revisión**) y con un clic **crea la cotización** (`COT`), que ya trae el cliente y los productos.
4. La cotización queda **Pendiente** y vale **15 días**. El cliente la puede ver en el **portal**.
5. Cuando el cliente acepta, la cotización se marca **Aprobada** y se **convierte en venta** (también puede convertirse directamente desde **Pendiente**, en un solo paso).
6. La venta genera la **factura** (`FAC`), descuenta las existencias y, si es a crédito, crea la **cuenta por cobrar**.
7. Contabilidad registra los **pagos** hasta que el saldo llega a cero y la factura queda **Pagada**.

En el detalle de cada documento se ve la cadena completa, por ejemplo `SOL-000004 › COT-000006 › FAC-000003`, y cada código abre su documento.

Capítulos: [Consultas web](?cap=consultas), [Cotizaciones](?cap=cotizaciones), [Ventas y facturación](?cap=ventas), [Pagos y cuentas por cobrar](?cap=pagos).

## La venta de mostrador

Cuando el cliente está presente no hace falta cotizar:

1. En el **Punto de venta** se buscan o escanean los productos, se elige el cliente y la forma de pago.
2. Al cobrar se genera la factura `FAC`.
3. Si fue de **contado** o por **transferencia**, la factura queda **Pagada**. Si fue a **crédito**, queda con saldo y aparece en **Pagos y CxC**.

Capítulo: [Punto de venta](?cap=pos).

## De la producción al producto terminado

NORCOR también fabrica algunos productos en su taller (por ejemplo, mangueras con terminales).

1. Para cada producto fabricado se define una **lista de materiales** (qué componentes lleva y cuántos por unidad) y una **ruta** (los pasos o estaciones de trabajo).
2. Se crea una **orden de producción** (`OP`) en **Borrador**, se **libera** y luego se **inicia**: en ese momento el sistema descuenta los materiales.
3. El taller marca cada paso de la ruta como hecho y **termina** la orden indicando cuántas unidades salieron bien.
4. Lo fabricado forma un **lote** (`LOT`) que queda **Por inspeccionar**.
5. Calidad **inspecciona** el lote: las unidades conformes entran al inventario de la bodega; las no conformes se mandan a retrabajo, se desechan o se liberan por concesión.

Capítulo: [Producción](?cap=produccion).

## Del reclamo a la garantía

1. El cliente reporta una falla: en persona, por teléfono o desde el sitio web (motivo **Servicio o garantía**, o **Reclamo**).
2. Se registra una **orden de servicio** (`OPI`). Si el equipo se compró en NORCOR o el trabajo ya se había hecho antes y la garantía sigue vigente, se marca **En garantía**.
3. Se **asigna** a un técnico, que la pasa a **En proceso** y, al terminar, la **completa** describiendo el trabajo y la garantía que se da sobre él.
4. Si la orden **tenía costo**, se **factura** enlazándola a la venta del servicio. Si estaba **en garantía**, se cierra sin cobrar.

Hay dos tipos de garantía:

- **Garantía del producto**: los días se definen en la ficha de cada producto y cuentan desde la fecha de la venta.
- **Garantía del trabajo**: la da el técnico al completar una orden (por lo general 90 días). Si la misma falla vuelve dentro de ese plazo, el arreglo no se cobra.

Capítulo: [Órdenes de servicio](?cap=ordenes).

## Lo que se ve en todos lados

- El **Dashboard** muestra cada mañana lo que necesita atención y lleva directo a resolverlo.
- Los **Reportes** resumen ventas, márgenes, cobros e inventario.
- La **Auditoría** guarda quién hizo cada cosa, cuándo y desde dónde.
- El **Catálogo web** decide qué productos se ven en el sitio público, con su foto y su precio.
