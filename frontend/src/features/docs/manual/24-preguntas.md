---
id: preguntas
titulo: Preguntas frecuentes
grupo: Ayuda
modulo:
resumen: Respuestas rápidas a los problemas y dudas más comunes al usar el sistema, ordenadas por tema.
---

## Acceso y sesión

### Dice «Usuario o contraseña incorrectos»

- Revise que **Bloq Mayús** no esté activado (el sistema lo avisa debajo de la contraseña).
- Use el botón del ojo para ver lo que escribió.
- Puede entrar con su **usuario** o con su **correo**.
- Si no recuerda la contraseña, use **¿Olvidó su contraseña?** (vea [Recuperar la contraseña](?cap=acceso#recuperar-la-contrasena)).

### El acceso está bloqueado

Después de varios intentos fallidos, el acceso se bloquea **un minuto**. Espere a que termine la cuenta regresiva del botón y vuelva a intentarlo.

### No me llega el código para recuperar la contraseña

- Revise la carpeta de **correo no deseado**.
- Espere un minuto y use **Reenviar código**.
- Si sigue sin llegar, pida al administrador que revise el correo registrado en su usuario.

### El sistema me sacó y tuve que volver a entrar

- La sesión se cierra sola después de **15 minutos sin usar** el sistema.
- También se cierra si su contraseña se cambió desde otro equipo.

Al volver a entrar, el sistema lo lleva a la pantalla donde estaba.

### No veo un módulo en el menú, o dice «acceso denegado»

Su rol no tiene ese módulo. Revise [Roles y permisos](?cap=roles) y, si lo necesita para su trabajo, pídalo al administrador. Igual puede leer en este manual cómo funciona.

## Pantalla

### El indicador dice «Reconectando…»

Se perdió por un momento la conexión en tiempo real. El sistema reintenta solo y actualiza los datos al reconectarse. Si dura mucho, revise su conexión a internet o recargue la página con [[F5]].

### No encuentro un registro en una tabla

- Revise si hay **filtros activos** (las etiquetas debajo de los filtros) y haga clic en **Limpiar filtros**.
- Pruebe la **búsqueda global** con [[Ctrl + K]] y el código (`FAC-…`, `COT-…`, `OC-…`).
- Revise si está en otra **página** de la tabla.

### Falta una columna en una tabla

Haga clic en **Columnas** y márquela. **Restablecer** vuelve a las columnas de fábrica.

### ¿Cómo paso los datos a Excel?

Use los botones **⬇ Exportar CSV** (Productos, Ventas, Auditoría), **⬇ CSV** (Inventario) o **⬇ Ventas** / **⬇ Inventario** (Reportes). El archivo se abre con Excel.

### ¿Cómo imprimo o guardo en PDF?

Las facturas y las cotizaciones del portal tienen un botón **Imprimir**; en la ventana de impresión elija su impresora o **Guardar como PDF**. Este manual se descarga en PDF con **Descargar capítulo** o **Descargar todo el manual**, y ese archivo se puede imprimir. En la ventana de impresión elija su impresora o **Guardar como PDF**.

## Ventas y cotizaciones

### Un producto no aparece en el punto de venta

El punto de venta solo muestra productos **activos y con precio**. Revise el producto en [Productos](?cap=productos): si está inactivo, actívelo; si no tiene precio, pida a gerencia que se lo ponga.

### No me deja vender: «solo hay N disponibles»

No hay suficiente existencia **entre la sucursal y la bodega**. Revise el producto en [Inventario](?cap=inventario): si la mercadería llegó pero no se registró, reciba la compra; si la existencia está mal, haga un ajuste.

### El botón Cobrar no hace nada o muestra un aviso

Revise que haya **elegido el cliente**, que el carrito tenga productos y, si el pago es por transferencia, que haya escrito la **referencia**. Si es a crédito, el plazo debe estar entre 1 y 365 días.

### Me equivoqué en una venta

El **administrador** puede **anular** la venta (las unidades vuelven al inventario) y se registra una venta nueva correcta. Vea [Anular una venta](?cap=ventas#anular-una-venta).

### Una cotización dice «Vencida»

Las cotizaciones valen **15 días**. Haga una cotización nueva con los precios vigentes.

### No puedo convertir una cotización en venta

Si falta existencia de algún producto, el sistema no deja facturar. Reciba la compra pendiente o traslade la mercadería, o haga una cotización nueva con lo que hay.

## Pagos

### Registré un pago equivocado

Los pagos no se pueden borrar desde el sistema. Avise al administrador del sistema con el número de factura y el error.

### No me deja registrar un pago

El monto no puede ser mayor que el **saldo** de la factura, y si el medio es transferencia, la **referencia** es obligatoria.

## Inventario y compras

### La existencia del sistema no coincide con lo que hay

1. Revise los **Movimientos** del producto en [Inventario](?cap=inventario#movimientos) para ver qué entró y salió.
2. Si hay una diferencia real, haga un **ajuste** con el motivo correspondiente (*Conteo físico*, *Merma o daño*…).

### Me equivoqué al recibir una compra

La recepción no se deshace. Corrija la existencia con un **ajuste** de inventario con motivo *Corrección de registro* y explique en el detalle qué compra fue.

### ¿Por qué cambió el costo promedio de un producto?

Cada vez que se **recibe una compra**, el costo promedio se recalcula con el costo de lo que llegó (incluidos el flete y los gastos). Es normal que cambie.

### Un producto no aparece en el sitio web

Para publicarse debe estar **activo**, tener **precio** y tener su categoría y su marca activas. En [Catálogo web](?cap=catalogo) puede ver exactamente qué le falta.

## Producción y servicio técnico

### No puedo iniciar una orden de producción

Faltan materiales en la bodega. El aviso dice cuáles; use **Comprar faltantes** para pedirlos.

### No puedo terminar una orden de producción

Primero hay que marcar como **hechos** todos los pasos de la ruta.

### Lo fabricado no aparece en el inventario

Las unidades entran al inventario solo cuando calidad **inspecciona y libera** el lote. Revise **Lotes y calidad**.

### No me deja crear una orden de servicio en garantía

El cliente no tiene compras ni servicios con garantía **vigente**. Si no aplica la garantía, registre la orden **con costo**.

### Como técnico, no veo una orden

El técnico solo ve **las órdenes asignadas a él**. Pida al administrador que se la asigne.

## Clientes del sitio web

### Un cliente olvidó la contraseña del portal

El cliente debe escribir desde **Contacto** (motivo *Mi cuenta*) o por WhatsApp. Pase la solicitud al administrador del sistema para que le restablezca el acceso.

### Un cliente no puede crear su cuenta porque su RUC ya existe

Su empresa ya está registrada como cliente. Pase el caso al administrador del sistema para vincular la cuenta.

### El sitio dice «Ya recibimos varias solicitudes desde su conexión»

Es una protección contra abusos que limita los mensajes por hora. El cliente puede intentar más tarde o escribir por WhatsApp.

## Sobre este manual

### Encontré algo que no coincide con el sistema

Avise al administrador del sistema. El manual está en archivos de texto dentro del sistema y se puede actualizar fácilmente.
