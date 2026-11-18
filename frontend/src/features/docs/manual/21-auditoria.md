---
id: auditoria
titulo: Auditoría
grupo: Control
modulo: auditoria
resumen: La bitácora de todo lo que pasa en el sistema — quién hizo qué, cuándo y desde dónde — y cómo buscar y exportar los registros.
---

## Para qué sirve

La **Auditoría** :ic-history: es la bitácora del sistema. Cada vez que alguien inicia sesión, crea, modifica, anula o cancela algo, el servidor guarda un registro con:

- la **fecha y hora**;
- el **usuario** que lo hizo;
- el **módulo** (ventas, inventario, producción…);
- la **acción** y una descripción en palabras, por ejemplo *Venta FAC-000003 anulada: error en la cantidad facturada*;
- la dirección **IP** del equipo desde donde se hizo.

Sirve para responder preguntas como *¿quién cambió este precio?*, *¿quién anuló esta factura y por qué?* o *¿quién entró al sistema ayer en la noche?*

Se abre en el menú **Auditoría**. La ven el administrador y gerencia.

![La bitácora de auditoría.](/manual/auditoria.webp)

## Leer la bitácora

Los registros aparecen del más reciente al más antiguo. La pantalla se actualiza sola cuando alguien hace algo.

En la columna **Acción**, junto a la descripción, se ve el código de la acción y la IP. Algunos códigos frecuentes: `LOGIN` (inicio de sesión), `LOGIN_FAILED` (contraseña equivocada), `LOGOUT`, `CREATE` (creó), `UPDATE` (modificó), `VOID` (anuló), `CANCEL` (canceló), `START` y `COMPLETE` (inició y terminó).

## Buscar registros

- **Buscar en la descripción**: escriba un código (`FAC-000003`, `OC-000002`, un SKU…) o una palabra (*precio*, *anulada*, *recepción*).
- **Módulo**: Seguridad (inicios de sesión y cambios de contraseña), Usuarios, Productos, Inventario, Compras, Producción, Ventas, Pagos, Cotizaciones, Clientes, Proveedores, OPI, Consultas, Portal clientes, Categorías, Marcas, Reportes o Configuración.
- **Fecha desde / hasta**: un periodo.
- **@usuario**: el nombre de usuario de una persona, por ejemplo `jflores`.

Los filtros se combinan. Por ejemplo: módulo *Ventas* + descripción *anulada* + el mes pasado = todas las anulaciones de ese mes.

## Exportar

**⬇ Exportar CSV** descarga **lo que está filtrado** en un archivo para Excel. Úselo para entregar evidencia a gerencia o a un auditor.

## Reglas de la bitácora

> **Importante:** La auditoría es de **solo lectura**. Nadie, ni siquiera el administrador, puede modificar ni borrar un registro desde el sistema. Por eso es la prueba confiable de lo que pasó.

- Las acciones delicadas piden un **motivo** (anular una venta, cancelar una compra, ajustar inventario, cambiar un precio…), y ese motivo queda en la descripción.
- Los intentos de acceso fallidos, los bloqueos y los cambios de contraseña también quedan registrados (módulo *Seguridad*).
- Como todo queda a nombre de quien lo hizo, **cada persona debe usar solo su propio usuario**.
