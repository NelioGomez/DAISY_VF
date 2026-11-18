# NORCOR Fueling System — Backend

API REST con **NestJS 11 + TypeScript + Prisma 7 + PostgreSQL**.

## Requisitos

- Node.js 22 o superior (`node -v`)
- PostgreSQL 15 o superior en ejecución
- npm

## 1. Instalar dependencias

Con el `package.json` incluido (equivale a un `requirements.txt`):

```bash
npm install
```

<details>
<summary>O instalar paquete por paquete (equivalente)</summary>

```bash
npm i @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/jwt@^11 \
  @nestjs/passport@^11 @nestjs/swagger@^11 @nestjs/config@^4 @nestjs/mapped-types@^2.1 \
  @nestjs/throttler passport passport-jwt class-validator class-transformer \
  reflect-metadata rxjs bcrypt @prisma/client@^7 @prisma/adapter-pg@^7 pg dotenv

npm i -D @nestjs/cli@^11 @nestjs/schematics@^11 @nestjs/testing@^11 prisma@^7 typescript@~5.9 \
  tsx @types/node@^22 @types/express @types/passport-jwt @types/bcrypt @types/pg \
  @types/jest @types/supertest jest ts-jest supertest eslint prettier typescript-eslint
```
</details>

## 2. Crear la base de datos

```bash
psql -U postgres -c "CREATE DATABASE norcor;"
```

## 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

- `DATABASE_URL`: usuario, clave y base reales.
- `JWT_SECRET`: genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `SEED_ADMIN_PASSWORD`: mínimo 12 caracteres (se usa solo para crear el administrador inicial).

## 4. Prisma: cliente, migración y seed

```bash
npx prisma generate                              # genera src/generated/prisma
npx prisma migrate dev --name init --create-only # crea la migración sin aplicarla
```

Abre `prisma/migrations/<fecha>_init/migration.sql` y pega **al final** el contenido de
`prisma/sql/checks.sql` (restricciones CHECK que Prisma no soporta en el esquema). Luego:

```bash
npx prisma migrate dev     # aplica la migración
npx prisma db seed         # roles, permisos, administrador y TAX_RATE
```

## 5. Ejecutar

```bash
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Comprobación: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/docs

## Autenticación (Fase 7)

Rutas bajo `/api/v1` (todas exigen `Authorization: Bearer <token>` salvo `/auth/login` y `/health`):

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/auth/login` | pública (máx. 5 intentos/min) |
| GET | `/auth/me` | autenticado |
| POST | `/auth/logout` | autenticado |
| GET | `/users` · `/users/:id` | `users:read` |
| POST | `/users` | `users:write` |
| PATCH | `/users/:id` · `/users/:id/status` | `users:write` |
| POST | `/users/:id/reset-password` | `users:write` |
| PATCH | `/users/me/password` | autenticado |
| GET | `/roles` · `/roles/permissions` | `users:read` |
| PUT | `/roles/:id/permissions` | `users:write` |

Prueba rápida en PowerShell:

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/login `
  -ContentType 'application/json' -Body '{"username":"admin","password":"TU_SEED_ADMIN_PASSWORD"}'
$h = @{ Authorization = "Bearer $($r.data.accessToken)" }
Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/me -Headers $h
Invoke-RestMethod -Uri http://localhost:3000/api/v1/users -Headers $h
```

En Swagger (`/api/docs`): ejecuta `POST /auth/login`, copia `data.accessToken`, pulsa **Authorize** y pégalo.

## Productos, categorías y marcas (Fase 8)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/products` (búsqueda, filtros, orden, paginación) | `products:read` |
| GET | `/products/export` (CSV con los mismos filtros) | `products:read` |
| GET | `/products/:id` | `products:read` |
| POST · PATCH · DELETE | `/products` · `/products/:id` | `products:write` |
| PATCH | `/products/:id/status` | `products:write` |
| GET / POST / PATCH / DELETE | `/categories`, `/categories/:id`, `/categories/:id/status` | `categories:read` / `categories:write` |
| GET / POST / PATCH / DELETE | `/brands`, `/brands/:id`, `/brands/:id/status` | `brands:read` / `brands:write` |

Filtros de `GET /products`: `search`, `categoryId`, `brandId`, `isActive`, `lowStock=true`,
`sortBy` (`name|sku|salePrice|stock|createdAt`), `sortOrder` (`asc|desc`), `page`, `limit`.

Reglas: el SKU es único y se guarda en mayúsculas; los productos **nacen con stock 0 y costo promedio 0**
(solo cambian con movimientos de inventario, Fase 9); un producto con movimientos, cotizaciones o ventas
no se puede eliminar, solo desactivar (409); una categoría o marca con productos tampoco.

Tras actualizar, vuelve a ejecutar `npx prisma db seed` (es idempotente): el rol Vendedor gana lectura de
categorías y marcas.

## Actualizar a las fases 9–14

El esquema ganó una tabla (`document_sequences`) y tres columnas en `sales`. Desde la carpeta `backend`:

```powershell
npm install                                   # nueva dependencia: decimal.js
npx prisma generate
npx prisma migrate dev --name phases_9_14     # crea y aplica la migración
npx prisma db seed                            # idempotente: agrega el permiso sales:void y CREDIT_TERM_DAYS
npm run start:dev
```

## Actualizar a las mejoras de octubre 2026

Compras y reabastecimiento, venta tipo POS, ficha de producto, solicitud → cotización,
trazabilidad, sitio público y portal de clientes. Desde la carpeta `backend`:

```powershell
npm install
npx prisma generate
npx prisma migrate deploy   # aplica 20261030120000_proveedores_por_producto (solo datos; se puede repetir)
npm run start:dev
```

Desde la carpeta `frontend`:

```powershell
npm install
npm run dev                 # http://localhost:5173
```

En `backend/.env` hay una variable nueva y opcional: `PORTAL_JWT_EXPIRES_IN=2h` (duración de la
sesión de los clientes). Los datos de contacto del sitio público se guardan con
`PATCH /api/v1/settings` (`COMPANY_PHONE`, `COMPANY_EMAIL`, `COMPANY_WHATSAPP`, `COMPANY_ADDRESS`,
`COMPANY_HOURS`); mientras estén vacíos, el sitio solo muestra lo que tenga valor.

### Rutas del frontend

| Ruta | Pantalla |
| --- | --- |
| `/` | Inicio público: rótulo "Precios desde" por categoría, más vendidos, cómo cotizar, marcas |
| `/catalogo` · `/catalogo/:id` | Productos con búsqueda, filtros, orden y paginación; ficha pública con relacionados |
| `/nosotros` · `/contacto` | Empresa (misión/visión marcadas como propuesta) y contacto con formulario |
| `/clientes/ingresar` · `/clientes/registro` | Acceso de clientes, separado del acceso interno |
| `/clientes/cuenta/solicitudes` · `/cotizaciones` · `/perfil` | Portal del cliente |
| `/login` · `/app/...` | Sistema interno (Compras en `/app/compras`, POS en `/app/ventas/nueva`; `?cliente=<id>` preselecciona el cliente) |

En el sistema interno: **Ctrl + K** abre la búsqueda global, **Alt + V** el punto de venta, **Alt + C** una
cotización nueva y **Esc** cierra ventanas y paneles. Cotizaciones tiene vista de tabla y de pipeline.

**Punto de venta** (menú Operación → Punto de venta): acepta lector de código de barras (el código se
registra en el formulario del producto; el lector escribe el código y Enter), SKU exacto o búsqueda por nombre.
Atajos: **F2** buscar producto, **F4** cliente, **F9** cobrar. Permite crear un cliente sin salir, calcula el
vuelto en ventas de contado y la factura se puede imprimir. El efectivo recibido no se guarda en la base de
datos: solo se usa para el vuelto y el comprobante de esa venta.

### Endpoints nuevos

| Método y ruta | Uso |
| --- | --- |
| `GET/POST /purchases`, `GET/PATCH/DELETE /purchases/:id` | Órdenes de compra (borrador editable) |
| `POST /purchases/:id/order` · `/receive` · `/cancel` | Ordenar, registrar recepción (total o parcial) y anular |
| `GET /purchases/restock`, `POST/DELETE /purchases/restock/:productId/postpone` | Sugerencias de reabastecimiento y posponer |
| `GET /products/:id/detail` | Ficha 360° del producto (proveedores, compras, ventas, movimientos) |
| `POST /inquiries/:id/quotation` | Crear la cotización desde la solicitud (precarga cliente y productos) |
| `POST /portal/auth/register` · `/portal/auth/login` | Registro e inicio de sesión de clientes (token propio) |
| `GET/PATCH /portal/me`, `PATCH /portal/me/password` | Perfil y contraseña del cliente |
| `GET/POST /portal/inquiries`, `GET /portal/inquiries/:id` | Lista de cotización enviada y su seguimiento |
| `GET /portal/quotations`, `GET /portal/quotations/:id` | Cotizaciones del cliente (sin borradores) |
| `GET /public/products/:id` · `GET /public/categories` | Ficha pública con relacionados; categorías con cantidad y precio "desde" |
| `POST/PATCH /products` (campo `barcode`) | Código de barras único por producto; la búsqueda de productos lo encuentra por coincidencia exacta |
| `GET /search?q=` | Búsqueda global (Ctrl + K) en los módulos que el rol puede leer |
| `GET /customers/:id/summary` | Perfil 360° del cliente: indicadores e historial de ventas, cotizaciones, solicitudes, pagos y OPI |
| `GET /dashboard/summary` (ampliado) | Ventas de los 30 días anteriores, conversión de cotizaciones, antigüedad de CxC, compras por recibir y pendientes accionables (campana y "Pendientes para hoy") |

El token de cliente no sirve en la API interna y el del personal no sirve en `/portal`.

## Manufactura: BOM, rutas, órdenes de producción, lotes y calidad

Bloque manufacturero alrededor del producto piloto **Manguera 3/4" × 10 pies con terminales**.
Demuestra el flujo **compra → recepción → producción → inventario → venta** con lote, no conformidad
y su disposición. Desde la carpeta `backend`:

```powershell
npm install
npx prisma generate
npx prisma migrate deploy      # aplica 20261031000000_manufactura
npm run seed:manufactura       # datos maestros del piloto (se puede repetir)
npm run start:dev
```

La migración crea `boms`, `bom_items`, `production_routes`, `route_operations`, `production_orders`,
`production_consumptions`, `production_order_steps`, `production_lots` y `quality_inspections`; agrega la
unidad `FOOT` (pie) y las columnas `production_order_id` / `production_lot_id` a `inventory_movements`, y los
permisos `production:read|write` y `quality:read|write` (Administrador y Enc. de inventario: todo; Gerencia:
lectura). El seed **no** carga stock ni precio: el stock entra con una compra y el precio lo fija Gerencia.

| SKU | Producto | Unidad |
| --- | --- | --- |
| `MNG-34-PIE` | Manguera 3/4" a granel (por pie) | pie |
| `TRM-34-M` / `TRM-34-H` | Terminal macho / hembra 3/4" NPT | unidad |
| `MNG-34-10P` | Manguera 3/4" × 10 pies con terminales (producto terminado) | unidad |
| `LM-000001` | BOM: 10 pies de manguera + 1 terminal macho + 1 terminal hembra | — |
| `RT-000001` | Ruta: 10 Medición y corte → 20 Acoplamiento de terminales → 30 Verificación | — |

**Recorrido para la defensa** (usuario `ngomez` o `admin`):

1. **Compras** → nueva compra de 50 pies de `MNG-34-PIE` y 5 de cada terminal → ordenar → registrar recepción.
2. **Producción** → *Nueva orden de producción* → `MNG-34-10P`, cantidad 5 (OP-000001): muestra lo requerido y si
   alcanza. *Liberar* → *Iniciar producción*: descarga los materiales del inventario al costo promedio (salidas
   con origen OP en el kardex). Si falta material, no deja iniciar y ofrece *Comprar faltantes*.
3. Marcar los pasos de la ruta en orden → *Terminar orden*: las unidades forman el lote `LOT-…` **por inspeccionar**
   (todavía no están en el inventario).
4. *Inspeccionar*: conformes / no conformes. Para las no conformes se elige la disposición: **Retrabajo** (vuelven a
   inspección), **Scrap** (se desechan) o **Liberación por concesión** (entran con el defecto documentado). Lo
   liberado entra al inventario con costo = materiales consumidos ÷ unidades producidas.
5. Gerencia fija el precio de `MNG-34-10P` → **Punto de venta** → vender.
6. **Dashboard** → tarjeta *Manufactura*: rendimiento (yield = liberadas ÷ planificadas de las OP terminadas),
   tasa de no conformidad (no conformes ÷ inspeccionadas en la primera inspección) y tiempo de ciclo promedio
   (inicio → término), todo de los últimos 30 días y calculado por el servidor.

Los productos tienen ahora **unidad de medida** (formulario de producto). La búsqueda global (Ctrl + K) encuentra
órdenes `OP-…` y lotes `LOT-…`, y el kardex muestra el origen de cada movimiento de producción.

| Método y ruta | Permiso | Uso |
| --- | --- | --- |
| `GET/POST /production/boms`, `GET/PATCH /production/boms/:id`, `PATCH …/:id/status` | `production:*` | BOM; si ya se usó, editar crea una versión nueva |
| `GET/POST /production/routes`, `GET/PATCH /production/routes/:id`, `PATCH …/:id/status` | `production:*` | Rutas y operaciones |
| `GET/POST /production/orders`, `GET /production/orders/:id` | `production:*` | Órdenes (detalle con materiales, pasos, lotes y movimientos) |
| `POST /production/orders/:id/release` · `/start` · `/complete` · `/cancel` | `production:write` (+ `inventory:write` para iniciar) | Ciclo de la orden |
| `POST /production/orders/:id/steps/:stepId/complete` | `production:write` | Registrar un paso de la ruta (en orden) |
| `GET /production/lots`, `GET /production/lots/:id` | `production:read` | Lotes con su historial de inspecciones |
| `POST /production/lots/:id/inspections` | `quality:write` | Inspección: `defectiveQuantity`, `disposition` (REWORK/SCRAP/RELEASE) |

## Bodega y sucursal, rotación y tablas (mejoras 11, 12, 18-20, 22, 23, 27, 29 y 30)

Desde la carpeta `backend`:

```powershell
npx prisma generate
npx prisma migrate deploy      # aplica 20261101000000_existencias_por_ubicacion
npm run start:dev
```

**Existencias por ubicación (n.° 23).** `products.stock` sigue siendo el total; la tabla `product_stocks`
lo reparte entre la **Bodega principal** (1) y la **Sucursal principal** (2) y un trigger diferido de la BD
verifica al confirmar cada transacción que la suma por ubicación sea igual al total. Al migrar, toda la
existencia queda en la bodega. Reglas:

- Recepciones de compra, producción (lotes liberados) y ajustes: en la ubicación indicada (por defecto la bodega).
- **Ventas: primero de la sucursal y, si no alcanza, de la bodega** (un movimiento por ubicación); la anulación devuelve a la sucursal.
- Consumo de materiales de producción: primero de la bodega y luego de la sucursal.
- Salidas y ajustes manuales: en la ubicación elegida; el ajuste fija lo contado **en esa ubicación**.
- **Traslados** `TR-000001` (Inventario → ⇄ Trasladar): salida en el origen y entrada en el destino al mismo
  costo promedio; no cambian el stock total ni el costo.

**Rotación y días de inventario (n.° 11 y 12).** Inventario → Rotación: alta (el stock alcanza ≤ 30 días),
media (31-90), baja (> 90) y sin movimiento (sin ventas en 90 días), con el valor detenido en cada grupo y CSV.

**Tablas (n.° 18-22, 27).** Filtros por módulo con chips removibles y "Limpiar filtros", paginación de 25/50/100
filas (Kardex y Auditoría se paginan y filtran en el servidor), encabezados fijos y esqueletos de carga.
**Errores recuperables (n.° 29):** si una parte no carga, la pantalla lo dice y ofrece *Reintentar* solo esa parte.

| Método y ruta | Permiso | Uso |
| --- | --- | --- |
| `GET /inventory/locations` | `inventory:read` | Bodega y sucursal con unidades y valor |
| `GET/POST /inventory/transfers`, `GET /inventory/transfers/:id` | `inventory:read` / `inventory:write` | Traslados entre ubicaciones |
| `GET /inventory/rotation` | `inventory:read` | Rotación y días de inventario por producto |
| `POST /inventory/movements` (campo `locationId`) | `inventory:write` | Entrada, salida o ajuste en una ubicación |
| `POST /purchases/:id/receive` (campo `locationId`) | `purchases:write` | Recibir en la bodega (por defecto) o la sucursal |
| `GET /inventory/movements?locationId=` | `inventory:read` | Kardex filtrado por ubicación |
| `GET /products` (campo `stockByLocation`) | `products:read` | Existencia en cada ubicación |

## Fotos, columnas, panel lateral, vista previa y comparador (mejoras 4, 21, 32-34 y 38)

No hay migración nueva. Desde la carpeta `backend`:

```powershell
npx prisma generate
npm run start:dev
npm run seed:real      # opcional: 173 productos reales con sus imágenes (ver docs/carga-datos-reales.md)
```

> Si al iniciar aparecen errores como `Property 'stockTransfer' does not exist` o
> `has no exported member 'StockTransferGetPayload'`, falta regenerar el cliente de Prisma:
> detenga `start:dev`, ejecute `npx prisma generate` (y `npx prisma migrate deploy`) y vuelva a iniciar.

**Fotografías (n.° 4).** En el formulario del producto: *Subir foto* (o arrastrarla), *Cambiar* y *Quitar*,
con vista previa. El navegador la reduce a 1200 px (WebP) antes de subirla; la API acepta JPG, PNG o WebP de
hasta 2 MB, reconoce el formato por el contenido del archivo y le pone un nombre propio. Se guardan en
`backend/uploads/products` (`UPLOADS_DIR` para otra carpeta; no va al repositorio) y se sirven en
`/api/v1/uploads/products/…`. Al reemplazar o quitar una foto subida, el archivo anterior se borra. También se
puede usar una imagen del catálogo del equipo (`/product-images/catalogo/…`) o una URL http(s). La foto
aparece en Productos, Existencias, la ficha, el punto de venta, la búsqueda global, el catálogo interno y el
sitio público; sin foto se muestra el ícono de la categoría.

**Columnas configurables (n.° 21).** Botón *Columnas* en Productos, Existencias, Kardex, Compras,
Cotizaciones, Ventas, Clientes y Proveedores: mostrar u ocultar y mover a la izquierda o a la derecha.
Cada tabla recuerda su configuración en el navegador; *Restablecer* vuelve al orden original. Hay columnas
extra ocultas de inicio (código de barras, bodega/sucursal, vendedor, vence, notas…).

**Ruta de navegación y panel lateral (n.° 32 y 33).** Todo detalle se abre en un panel lateral sin salir de la
lista: facturas, cotizaciones, solicitudes, compras, órdenes de producción, lotes, traslados, productos,
clientes y **proveedores** (nuevo: compras, productos que surte y último costo). La barra superior muestra
`Inicio › Módulo › Registro` (p. ej. *Inicio › Ventas y Facturación › Factura FAC-000125*) y cada registro
tiene dirección propia (`/app/ventas?venta=<id>`, `?producto=`, `?proveedor=`…): se puede copiar, recargar, y
Atrás/Esc cierran el panel. En pantallas de 1440 px o más la lista queda a la izquierda y sigue usable
(vista dividida); en pantallas menores el panel se superpone debajo de la barra superior.

**Vista previa rápida (n.° 34).** En el sistema, al detener el cursor (o enfocar con el teclado) sobre un
producto o un cliente aparece una tarjeta con foto, SKU, precio y existencias por ubicación, o contacto,
total comprado y saldo. En el catálogo público, *Vista rápida* abre el producto sin salir de la lista.

**Comparador (n.° 38).** En el catálogo público, *Comparar* en hasta 4 productos; la barra inferior lleva a
`/catalogo/comparar?ids=…`: foto, precio (marca el menor), disponibilidad, marca, categoría, unidad y
descripción lado a lado, con *Resaltar diferencias* y *Solo lo que cambia*.

| Método y ruta | Permiso | Uso |
| --- | --- | --- |
| `POST /products/:id/image` (multipart, campo `file`) | `products:write` | Sube o reemplaza la foto |
| `DELETE /products/:id/image` | `products:write` | Quita la foto |
| `GET /uploads/products/:archivo` | público | Archivo de la foto (caché de 30 días) |
| `GET /suppliers/:id/summary` | `suppliers:read` | Panel del proveedor: compras, productos e indicadores |
| `GET /public/products/compare?ids=a,b,c` | público | Comparación de 2 a 4 productos y sus diferencias |
| `GET /search?q=` (campo `imageUrl`) | según módulo | La búsqueda global trae la foto del producto |

## Inventario (Fase 9)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/inventory` (existencias + valor de inventario + resumen; mismos filtros que `/products`) | `inventory:read` |
| GET | `/inventory/movements` (kardex: `productId`, `type`, `supplierId`, `userId`, `search`, `from`, `to`) | `inventory:read` |
| POST | `/inventory/movements` | `inventory:write` |

Cuerpo de `POST /inventory/movements` según el tipo:

- `ENTRY` (compra): `productId`, `quantity`, `unitCost`, opcional `supplierId`, `reference`, `note`. Recalcula el **costo promedio ponderado**.
- `EXIT` (merma/uso interno): `productId`, `quantity`, `note` (≥ 5 caracteres). Sale al costo promedio vigente. Las ventas descuentan solas.
- `ADJUSTMENT` (conteo físico): `productId`, `newStock` (valor absoluto contado), `note` (≥ 5 caracteres).

El stock **nunca** se modifica fuera de `StockService`: cada cambio bloquea la fila del producto (`SELECT … FOR UPDATE`), crea su movimiento y ocurre dentro de una transacción.

## Clientes y proveedores (Fase 10)

| Método | Ruta | Permiso |
|---|---|---|
| GET / POST / PATCH / DELETE | `/customers`, `/customers/:id`, `/customers/:id/status` | `customers:read` / `customers:write` |
| GET / POST / PATCH / DELETE | `/suppliers`, `/suppliers/:id`, `/suppliers/:id/status` | `suppliers:read` / `suppliers:write` |

RUC / identificador fiscal único (se guarda en mayúsculas; vacío = sin dato). Los clientes devuelven `salesCount`, `totalPurchases` y `pendingBalance` (solo ventas vigentes). Un cliente con cotizaciones, ventas u órdenes, o un proveedor con entradas de inventario, no se elimina (409): se desactiva. Proveedor: `isInternational` se deduce del país (≠ Nicaragua) si no se indica.

## Cotizaciones (Fase 11)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/quotations`, `/quotations/:id` | `quotations:read` |
| POST | `/quotations` (`asDraft: true` para borrador) | `quotations:write` |
| PATCH | `/quotations/:id` (solo BORRADOR/PENDIENTE; `items` reemplaza las líneas) | `quotations:write` |
| POST | `/quotations/:id/submit` · `/approve` · `/reject` | `quotations:write` |
| POST | `/quotations/:id/convert` | `quotations:write` **y** `sales:write` |
| DELETE | `/quotations/:id` (solo BORRADOR) | `quotations:write` |

Ciclo: `DRAFT → PENDING → APPROVED → CONVERTED`; `PENDING/APPROVED → REJECTED`; las abiertas pasan a `EXPIRED` al vencer `validUntil` (por defecto 15 días, máximo 365). El servidor calcula subtotal, IVA (`TAX_RATE`) y total: nunca confía en los del cliente.

## Ventas y facturación (Fase 12)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/sales`, `/sales/:id` | `sales:read` |
| POST | `/sales` (venta directa) | `sales:write` |
| POST | `/sales/:id/void` | `sales:void` (solo Administrador por defecto) |

Formas de pago: `CASH` / `TRANSFER` cobran todo en el acto (`PAID`); `CREDIT` deja saldo (`PENDING`, o `PARTIAL` si hay `initialPayment` con `initialPaymentMethod`), vence en `creditDays` (por defecto `CREDIT_TERM_DAYS` = 15). Una venta es **una sola transacción**: valida, bloquea productos, descuenta stock al costo promedio (guardado en cada línea para márgenes), numera `FAC-000001`, crea la venta y su pago. Si falta stock en cualquier línea no se guarda nada y el 409 lista cada línea afectada. Anular devuelve el stock con una entrada al costo original, deja el saldo en 0 y conserva los pagos (`refundDue` indica lo que hay que reintegrar).

## Pagos y cuentas por cobrar (Fase 13)

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/payments` (abono: `saleId`, `amount`, `method` CASH/TRANSFER, `reference`) | `payments:write` |
| GET | `/payments` (`saleId`, `customerId`, `method`, `userId`, `from`, `to`) | `payments:read` |
| GET | `/payments/receivables` (`customerId`, `overdue`, `search`; resumen con vencido) | `payments:read` |
| GET | `/payments/receivables/by-customer` | `payments:read` |

El abono no puede superar el saldo; la fila de la venta se bloquea para que dos abonos simultáneos no se pasen. El saldo siempre se recalcula como `total − suma de pagos`.

## Órdenes de servicio OPI (Fase 14)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/service-orders`, `/service-orders/:id`, `/service-orders/technicians` | `service-orders:read` |
| POST · PATCH | `/service-orders` · `/service-orders/:id` | `service-orders:write` |
| POST | `/:id/assign` · `/start` · `/complete` · `/invoice` · `/cancel` | `service-orders:write` |

Flujo: `REGISTERED → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED` (`CANCELLED` desde cualquier estado no final). Un usuario con rol Técnico solo ve y avanza **sus** órdenes (`start`, `complete`, notas); crear, asignar, facturar y cancelar es del personal no técnico. Para facturar se indica una venta vigente del mismo cliente.

### Prueba de punta a punta (PowerShell)

```powershell
$base = 'http://localhost:3000/api/v1'
$r = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body '{"username":"admin","password":"TU_SEED_ADMIN_PASSWORD"}'
$h = @{ Authorization = "Bearer $($r.data.accessToken)" }
function Post($path, $obj) { Invoke-RestMethod -Method Post -Uri "$base$path" -Headers $h -ContentType 'application/json' -Body ($obj | ConvertTo-Json -Depth 6) }

$prod = (Post '/products' @{ sku='DEMO-001'; name='Boquilla demo'; salePrice=100 }).data
$null = Post '/inventory/movements' @{ productId=$prod.id; type='ENTRY'; quantity=20; unitCost=60 }
$cus  = (Post '/customers' @{ name='Estación Demo'; ruc='J0000000001' }).data

$q = (Post '/quotations' @{ customerId=$cus.id; items=@(@{ productId=$prod.id; quantity=3 }) }).data
$null = Post "/quotations/$($q.id)/approve" @{}
$sale = (Post "/quotations/$($q.id)/convert" @{ paymentMethod='CREDIT'; initialPayment=100; initialPaymentMethod='CASH' }).data
$sale | Select-Object invoiceNumber, total, balance, paymentStatus
Post '/payments' @{ saleId=$sale.id; amount=245; method='CASH' }   # liquida el saldo
Invoke-RestMethod -Uri "$base/inventory" -Headers $h               # stock 17
```

## Dashboard (Fase 15)

`GET /api/v1/dashboard/summary` (permiso `dashboard:read`) devuelve datos reales; **cada sección depende de los permisos del usuario** y viene en `null` si no puede verla (un técnico solo recibe sus órdenes OPI; el valor del inventario exige `inventory:read`).

| Sección | Contenido | Permiso |
|---|---|---|
| `sales` | ventas últimos 30 días y acumuladas, serie de 14 días (hora de Nicaragua, con ceros), top 5 productos, por método de pago, últimas 5 ventas | `sales:read` |
| `inventory` | productos activos, stock crítico, agotados, valor del inventario, lista de reabastecimiento (con unidades faltantes) | `inventory:read` o `products:read` |
| `receivables` | saldo por cobrar, facturas abiertas, vencido (monto y cantidad) | `payments:read` o `sales:read` |
| `serviceOrders` | OPI abiertas y conteo por estado | `service-orders:read` |
| `quotations` | pendientes, aprobadas sin facturar, por vencer en 3 días | `quotations:read` |
| `inquiries` | consultas web nuevas | `inquiries:read` |
| `alerts` | alertas derivadas (agotados, stock crítico, facturas vencidas, cotizaciones por vencer, consultas nuevas) | según lo anterior |

Las ventas anuladas no suman en ningún indicador.

## Reportes (Fase 15)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/reports` (catálogo de reportes y sus filtros) | `reports:read` |
| GET | `/reports/:name` (JSON: `columns`, `rows`, `summary`, `filters`, `truncated`) | `reports:read` |
| GET | `/reports/:name/export` (CSV para Excel, queda auditado) | `reports:read` |

`:name` puede ser: `sales-by-period` · `sales-by-customer` · `sales-by-product` · `sales-by-seller` · `sales-by-payment-method` · `inventory` · `inventory-movements` · `receivables` · `payments` · `service-orders` · `quotations`.

Filtros (según el reporte): `from`, `to` (por defecto los últimos 30 días), `groupBy` (`day|week|month`), `groupOrders` (`status|technician`), `customerId`, `sellerId`, `technicianId`, `productId`, `categoryId`, `brandId`, `paymentMethod`, `movementType`, `lowStock`, `limit`. `inventory` y `receivables` son "a hoy" y no usan fechas. Los reportes de ventas incluyen costo y margen (costo promedio al momento de vender). Las cuentas por cobrar traen la antigüedad por tramos (vigente, 1-30, 31-60, 61-90 y +90 días). El formato `columns/rows` permite agregar PDF o Excel después sin tocar las consultas.

```powershell
Invoke-RestMethod "$base/dashboard/summary" -Headers $h
Invoke-RestMethod "$base/reports/sales-by-period?groupBy=month&from=2026-01-01" -Headers $h
Invoke-WebRequest "$base/reports/receivables/export" -Headers $h -OutFile cxc.csv
```

## Catálogo público y consultas (Fase 16)

Rutas **sin autenticación** bajo `/api/v1/public`:

| Método | Ruta | Notas |
|---|---|---|
| GET | `/public/products` | `search`, `categoryId`, `brandId`, `availability` (`AVAILABLE|LIMITED|OUT_OF_STOCK`), `sortBy` (`name|price`), `sortOrder`, `page`, `limit` (máx. 50) |
| GET | `/public/products/:id` | 404 si no está publicado |
| GET | `/public/categories` · `/public/brands` | para los filtros del catálogo |
| POST | `/public/inquiries` | "Solicitar cotización": `name`, `contact` (correo o teléfono), `productInterest`, `message`. Máx. **5 por hora por IP** (429) |

Solo se publican productos activos (con categoría y marca activas). **Nunca** se expone costo, stock exacto, stock mínimo, proveedores ni movimientos: el visitante ve `price` (null si el precio es 0, "consulte precio") y `availability`. El formulario incluye un campo trampa `website` que debe ir vacío: si un bot lo llena, la respuesta es "ok" pero no se guarda nada. El frontend debe mostrar los textos escapados (nunca como HTML).

Gestión interna:

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/inquiries` (`status`, `search`, `from`, `to`; incluye conteo por estado) · `/inquiries/:id` | `inquiries:read` |
| PATCH | `/inquiries/:id/status` (`NEW → ATTENDED → CLOSED`; una nueva puede cerrarse directamente) | `inquiries:write` |

## Auditoría (Fase 17)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/audit` (`userId`, `username`, `module`, `action`, `entity`, `entityId`, `search`, `from`, `to`, `page`, `limit`) | `audit:read` |
| GET | `/audit/filters` (módulos y acciones existentes) | `audit:read` |
| GET | `/audit/export` (CSV; la exportación también se registra) | `audit:read` |
| GET | `/audit/:id` (con `metadata`) | `audit:read` |

La bitácora es de **solo lectura**: no existen rutas para modificar ni borrar registros. Ya se registran inicio y cierre de sesión, altas, cambios, desactivaciones, movimientos de inventario, ventas, anulaciones, pagos, cotizaciones, OPI, consultas web y exportaciones.

Estas tres fases **no cambian el esquema**: no hace falta una migración nueva (basta `npm install` si aún no lo hiciste y reiniciar).

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor con recarga automática |
| `npm run build` | Compila a `dist/` |
| `npx prisma studio` | Explorador visual de la base de datos |
| `npx prisma migrate dev` | Crea/aplica migraciones en desarrollo |
| `npx prisma migrate deploy` | Aplica migraciones en producción |
| `npm test` | Pruebas unitarias |
| `npm run seed:manufactura` | Datos maestros del producto piloto de manufactura |

## Notas de diseño

- Prisma 7 requiere el adaptador `@prisma/adapter-pg`; la URL de conexión vive en `prisma.config.ts`, no en `schema.prisma`.
- El stock vive en `products` y nunca se modifica sin crear un registro en `inventory_movements` dentro de la misma transacción.
- `products.version` se incrementa en cada movimiento de stock. La consistencia la da el bloqueo de fila (`FOR UPDATE`) dentro de la transacción.
- Dinero: se calcula con `decimal.js` (nunca con `number`) y se guarda en columnas `DECIMAL`. IVA exclusivo: `total = subtotal + subtotal × TAX_RATE`.
- Numeración (`COT-`, `FAC-`, `OPI-`) con contador atómico en `document_sequences`, dentro de la misma transacción que crea el documento.
- El IVA (15%) se guarda en `system_config` (`TAX_RATE`), no en el código.
