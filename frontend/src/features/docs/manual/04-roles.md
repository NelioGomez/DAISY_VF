---
id: roles
titulo: Roles y permisos
grupo: Primeros pasos
modulo:
resumen: Qué puede ver y hacer cada rol del sistema y qué hacer si necesita un permiso que no tiene.
---

## Qué es un rol

Cada usuario tiene **un rol**, que corresponde a su puesto de trabajo. El rol decide:

- **qué módulos aparecen en su menú**, y
- **qué puede hacer en cada uno**: algunos roles solo consultan; otros pueden crear, modificar o anular.

El sistema revisa el permiso en cada acción, no solo en el menú. Si alguien intenta abrir la dirección de una pantalla que su rol no tiene, ve un aviso de acceso denegado.

Su rol aparece en la barra superior, debajo de su nombre. En este manual, al inicio de cada capítulo se indica qué roles usan ese módulo, y el suyo se ve resaltado.

## Los seis roles

| Rol | Su trabajo en el sistema |
|---|---|
| **Administrador** | Ve y hace todo. Es el único que puede **anular ventas** y entrar al [Panel de administración](?cap=administracion) (usuarios, cuentas del portal, categorías, marcas, datos de la empresa y actividad). Registra, asigna y factura las órdenes de servicio. |
| **Gerencia** | Consulta los indicadores, reportes, inventario, compras, producción, ventas y la auditoría. **Fija el precio de venta** de los productos. No registra ventas ni compras. |
| **Vendedor** | Atiende a los clientes: clientes, cotizaciones, punto de venta, consultas web y catálogo web. Ve los productos y precios para cotizar y vender, pero no los modifica. |
| **Encargado de inventario** | Productos, inventario (ajustes y traslados), pedidos de compra y su recepción, proveedores, producción y control de calidad. Ve los precios, pero no los fija. |
| **Contabilidad** | Registra los **pagos** de los clientes y controla las cuentas por cobrar. Consulta las ventas, las compras y los reportes. |
| **Técnico / OPI** | Trabaja **solo sus órdenes de servicio**: las inicia y las completa. No ve las órdenes de otros técnicos. |

## Qué módulos ve cada rol

**Sí** = puede trabajar en el módulo · **Ver** = solo consulta · **—** = no aparece en su menú. *Admin.* = administrador; *Inventario* = encargado de inventario; *Contab.* = contabilidad.

| Módulo | Admin. | Gerencia | Vendedor | Inventario | Contab. | Técnico |
|---|---|---|---|---|---|---|
| Dashboard | Sí | Sí | Sí | Sí | Sí | Sí |
| Reportes y KPIs | Sí | Ver | — | — | Ver | — |
| Productos | Sí | — | — | Sí | — | — |
| Compras y reabastecimiento | Sí | Ver | — | Sí | Ver | — |
| Proveedores | Sí | — | — | Sí | — | — |
| Inventario | Sí | Ver y precios | — | Sí | — | — |
| Clientes | Sí | — | Sí | — | — | — |
| Cotizaciones | Sí | — | Sí | — | — | — |
| Punto de venta | Sí | — | Sí | — | — | — |
| Ventas y facturación | Sí (y anula) | Ver | Sí | — | Ver | — |
| Órdenes de servicio | Sí | — | — | — | — | Sus órdenes |
| Consultas web | Sí | — | Sí | — | — | — |
| Catálogo web | Sí | — | Sí | — | — | — |
| Pagos y CxC | Sí | — | — | — | Sí | — |
| Producción | Sí | Ver | — | Sí | — | — |
| Auditoría | Sí | Ver | — | — | — | — |
| Documentación | Sí | Sí | Sí | Sí | Sí | Sí |

El **Dashboard** de cada rol muestra solamente la información de su trabajo: por ejemplo, el técnico ve sus órdenes de servicio y contabilidad ve las cuentas por cobrar.

## Acciones que necesitan un permiso especial

Algunas acciones tienen consecuencias importantes y solo las hacen ciertos roles:

| Acción | Quién la hace | Por qué |
|---|---|---|
| Anular una venta | Administrador | Devuelve la mercadería al inventario y cancela la cuenta por cobrar. |
| Cambiar el precio de venta | Administrador y Gerencia | El precio queda en un historial y se ve en el sitio web. |
| Ajustar existencias o trasladar mercadería | Administrador y Encargado de inventario | Cambia lo que el sistema dice que hay en bodega y en la sucursal. |
| Recibir una compra | Administrador y Encargado de inventario | Suma existencias y recalcula el costo promedio. |
| Registrar un pago | Administrador y Contabilidad | Baja el saldo de la factura del cliente. |
| Liberar o rechazar un lote de producción | Administrador y Encargado de inventario | Decide si lo fabricado entra al inventario. |
| Asignar, facturar o cancelar una orden de servicio | Administrador | Organiza el trabajo de los técnicos y su cobro. |

Todas estas acciones quedan registradas en la [Auditoría](?cap=auditoria) con el nombre de quien las hizo.

## Si necesita otro permiso

1. Revise en la tabla de arriba si su rol debería tenerlo.
2. Si lo necesita para su trabajo, pídaselo al **administrador del sistema**, explicando para qué lo necesita.
3. El administrador le cambia el rol en **Panel de administración › Usuarios**. Cierre sesión y vuelva a entrar para ver su menú actualizado.

> **Nota:** Puede leer en este manual cómo funciona cualquier módulo, aunque su rol no lo abra. En el índice, esos capítulos tienen un candado :ic-lock:.
