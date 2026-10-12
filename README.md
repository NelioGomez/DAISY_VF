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

## Notas de diseño

- Prisma 7 requiere el adaptador `@prisma/adapter-pg`; la URL de conexión vive en `prisma.config.ts`, no en `schema.prisma`.
- El stock vive en `products` y nunca se modifica sin crear un registro en `inventory_movements` dentro de la misma transacción.
- `products.version` se incrementa en cada movimiento de stock. La consistencia la da el bloqueo de fila (`FOR UPDATE`) dentro de la transacción.
- Dinero: se calcula con `decimal.js` (nunca con `number`) y se guarda en columnas `DECIMAL`. IVA exclusivo: `total = subtotal + subtotal × TAX_RATE`.
- Numeración (`COT-`, `FAC-`, `OPI-`) con contador atómico en `document_sequences`, dentro de la misma transacción que crea el documento.
- El IVA (15%) se guarda en `system_config` (`TAX_RATE`), no en el código.