---
id: pantalla
titulo: Conocer la pantalla
grupo: Primeros pasos
modulo:
resumen: Las partes que se repiten en todo el sistema — menú, barra superior, buscador, avisos, tablas, filtros y panel de detalle — y cómo se usan en computadora y en celular.
---

## Las partes de la pantalla

Todas las pantallas del sistema interno tienen la misma forma: el **menú** a la izquierda, la **barra superior** arriba y el **área de trabajo** al centro. Si aprende a usarlas una vez, le sirven en todos los módulos.

![Partes de la pantalla principal.](/manual/pantalla-general.webp)

1. **Menú**: los módulos que su rol puede abrir, agrupados por área.
2. **Título y ruta**: el nombre de la pantalla y, debajo, el camino para llegar a ella (por ejemplo *Inicio › Ventas y facturación › Factura FAC-000003*). Cada parte del camino es un enlace para regresar.
3. **En vivo**: indica que los datos se actualizan solos cuando otra persona hace un cambio.
4. **Buscar** [[Ctrl + K]]: busca en todo el sistema.
5. **Pendientes**: la campana con el número de tareas que esperan atención.
6. **Tema**: claro, oscuro o como el sistema de su computadora.
7. **Ayuda** :ic-circle-help:: abre en este manual el capítulo de la pantalla en que está.
8. **Sitio público** :ic-globe:: abre en otra pestaña el sitio web que ven los clientes.
9. **Usuario**: su nombre y su rol.
10. **Cerrar sesión** :ic-log-out:.
11. **Contraer menú**: deja el menú solo con íconos para ganar espacio.

Junto a la campana también se ven la **fecha y la hora** de Nicaragua.

## El menú

![Menú con el grupo Ventas abierto.](/manual/pantalla-menu.webp)

- El menú está dividido en grupos: **Dashboard**, **Compras**, **Ventas** y **Producción** se despliegan para mostrar sus pantallas; **Pagos y CxC**, **Auditoría** y **Documentación** son enlaces directos.
- Haga clic en el nombre de un grupo para abrirlo o cerrarlo. Se abre un grupo a la vez, y el grupo de la pantalla en que está se abre solo.
- La opción en la que está se ve resaltada.
- Solo aparecen los módulos de su rol. Si necesita otro, pídalo al administrador (vea [Roles y permisos](?cap=roles)).
- Los **números rojos** avisan de trabajo pendiente:

| Número junto a… | Qué cuenta |
|---|---|
| **Inventario** | Productos en o por debajo de su existencia mínima |
| **Pedidos de compra** | Compras que todavía esperan mercadería |
| **Cotizaciones** | Cotizaciones pendientes de respuesta del cliente |
| **Consultas web** | Solicitudes nuevas que llegaron desde el sitio o el portal |
| **Pagos y CxC** | Facturas de crédito con saldo por cobrar |

Si un grupo está cerrado, el número aparece junto al nombre del grupo.

### Menú contraído

![Con el menú contraído solo se ven los íconos; un punto rojo indica que ese grupo tiene pendientes.](/manual/pantalla-menu-contraido.webp)

Haga clic en **Contraer menú**, al pie del menú, para dejar solo los íconos y ganar espacio para las tablas. Al pasar el cursor sobre la barra de íconos, el menú se despliega completo; al retirarlo, se vuelve a contraer. Para dejarlo siempre abierto otra vez, haga clic en **Fijar menú**. El sistema recuerda cómo lo dejó.

## Buscar en todo el sistema

![La búsqueda global agrupa los resultados por tipo.](/manual/pantalla-busqueda.webp)

1. Haga clic en **Buscar** en la barra superior o presione [[Ctrl + K]] desde cualquier pantalla.
2. Escriba al menos dos letras: un nombre, un SKU, un RUC o un código como `FAC-000003`, `COT-000006`, `SOL-000004` u `OC-000002`.
3. Los resultados aparecen agrupados: productos, clientes, ventas, cotizaciones, solicitudes web, compras, órdenes y lotes de producción, órdenes OPI y proveedores.
4. Muévase con las flechas [[↑]] [[↓]] y presione [[Enter]] para abrir, o haga clic en el resultado. [[Esc]] cierra la búsqueda.

> **Nota:** Solo aparecen resultados de los módulos que su rol puede ver.

## Pendientes del día

![La campana muestra lo que espera atención; cada línea lleva a la pantalla donde se resuelve.](/manual/pantalla-pendientes.webp)

La campana reúne lo que necesita atención: productos con existencia crítica, órdenes de servicio sin técnico, lotes por inspeccionar, consultas web nuevas, cotizaciones aprobadas que aún no son venta y compras por recibir. Haga clic en una línea para ir directo a resolverla. El número rojo de la campana es el total de pendientes.

## Tema claro u oscuro

![Menú del tema.](/manual/pantalla-tema.webp)

Haga clic en el botón del tema :ic-sun: y elija:

- **Claro**: fondo blanco, ideal con mucha luz.
- **Oscuro**: fondo oscuro, cansa menos la vista de noche o en ambientes con poca luz.
- **Como el sistema**: sigue la configuración de su computadora o celular.

El cambio es inmediato y queda guardado en ese navegador. El sitio web público y el inicio de sesión también tienen este botón.

![El sistema en modo oscuro.](/manual/pantalla-oscuro.webp)

## Tablas, filtros y columnas

Casi todos los módulos muestran una **tabla** con los registros. Todas funcionan igual:

![Herramientas de una tabla, con un filtro aplicado.](/manual/pantalla-tabla.webp)

1. **Buscar**: escriba parte del nombre, código, cliente, etc. La tabla se filtra mientras escribe.
2. **Filtros**: listas para ver solo un grupo, por ejemplo una categoría o un estado. Algunas tablas también tienen un rango de **fechas** (*desde* y *hasta*).
3. **Filtros activos**: cada filtro aplicado aparece como una etiqueta. Haga clic en la **×** de una etiqueta para quitar solo ese filtro. Al lado se ve cuántos registros se muestran del total.
4. **Limpiar filtros**: quita todos los filtros de una vez.
5. **Columnas**: elija qué columnas ver y en qué orden.
6. **La tabla**: cada fila es un registro. Haga clic en la fila o en su código para abrir el detalle.
7. **Acciones de la pantalla**: botones como **+ Nuevo producto** o **Exportar CSV**, que descarga la lista completa en un archivo que se abre con Excel.

> **Nota:** Los filtros se limpian al salir de la pantalla. Lo que sí se recuerda en ese navegador es la elección de columnas y cuántas filas ver por página.

### Elegir columnas

![Ventana para mostrar, ocultar y ordenar columnas.](/manual/pantalla-columnas.webp)

1. Haga clic en **Columnas**.
2. Marque o desmarque cada columna para mostrarla u ocultarla.
3. Use las flechas para moverla a la izquierda o a la derecha.

El botón muestra cuántas columnas se ven, por ejemplo **Columnas (6/9)**. **Restablecer** vuelve a las columnas de fábrica. El sistema recuerda su elección en ese navegador.

### Páginas

![Barra de páginas al pie de la tabla.](/manual/pantalla-paginacion.webp)

Al pie de cada tabla se indica qué registros se ven (por ejemplo *1–25 de 178 productos*). Use las flechas o los números para cambiar de página y la lista **por página** para ver 25, 50 o 100 filas a la vez. Al cambiar un filtro, la tabla vuelve a la página 1.

### Vista previa

![Al detener el cursor sobre un producto aparece una tarjeta con lo esencial.](/manual/pantalla-vista-previa.webp)

Si detiene el cursor un momento sobre el nombre de un **producto** o de un **cliente**, aparece una tarjeta con sus datos principales (existencias, precio, saldo, etc.) sin abrir nada. En celulares y tabletas no aparece: un toque abre directamente el detalle.

## El panel de detalle

![El detalle de una factura abierto en el panel lateral.](/manual/pantalla-panel.webp)

Al abrir un registro (una factura, un producto, un cliente, una orden…) su detalle se muestra en un **panel lateral**, sin salir de la lista. En el panel están los datos completos y los botones para trabajar con ese registro.

- Para cerrarlo, haga clic en la **×**, presione [[Esc]] o use el botón **Atrás** del navegador.
- Los códigos que aparecen dentro del panel (por ejemplo, la cotización de la que salió una venta) son enlaces que abren ese otro registro.
- Cada registro tiene su propia dirección. Puede copiarla y enviarla, o recargar la página, y el panel se vuelve a abrir.

## Ventanas, avisos y confirmaciones

- Los formularios (nueva venta, nuevo cliente, recibir una compra…) se abren en una **ventana** sobre la pantalla. **Cancelar** o **Volver** la cierran sin guardar.
- Los campos que se pueden dejar en blanco dicen **(opcional)**. Si falta un dato obligatorio o hay un error, el sistema lo señala en rojo y no guarda hasta corregirlo.
- Al guardar aparece un **aviso** breve en la esquina: verde si salió bien y rojo si hubo un problema, con la explicación.
- Las acciones delicadas, como anular una venta o cancelar una orden, piden **confirmación** y un **motivo**, que queda en la [Auditoría](?cap=auditoria).

## En vivo: cambios de otros usuarios

El indicador **En vivo** de la barra superior significa que el sistema está conectado: si otra persona registra una venta, recibe una compra o cambia un precio, su pantalla se actualiza sola, sin recargar.

- Si dice **Reconectando…**, se perdió la conexión por un momento. El sistema vuelve a intentarlo solo y, al reconectarse, actualiza los datos.
- Al hacer clic en el indicador se **silencian** o se **activan** los avisos de cambios de otros usuarios. Los datos se siguen actualizando igual.

## Atajos de teclado

| Teclas | Qué hacen |
|---|---|
| [[Ctrl + K]] | Abre la búsqueda en todo el sistema |
| [[Alt + V]] | Abre el punto de venta para una venta nueva |
| [[Alt + C]] | Abre una cotización nueva |
| [[Esc]] | Cierra la ventana, el panel o la búsqueda abierta |
| [[Enter]] | Confirma o abre el resultado elegido |

Los atajos de venta y cotización solo funcionan si su rol puede vender o cotizar.

## En el celular

El sistema funciona también en celulares y tabletas.

![En el celular el menú se abre con el botón de la esquina.](/manual/pantalla-celular-1.webp)

![El menú abierto en el celular.](/manual/pantalla-celular-2.webp)

- Toque el botón del menú :ic-menu: de la esquina superior izquierda para abrir el menú; toque fuera de él o elija una opción para cerrarlo.
- Las tablas anchas se deslizan hacia los lados con el dedo.
- Los paneles y ventanas ocupan toda la pantalla.

> **Consejo:** Para trabajos largos, como recibir una compra grande o armar una cotización de muchas líneas, es más cómodo usar una computadora.
