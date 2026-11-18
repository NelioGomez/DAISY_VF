# Carga de productos reales de NORCOR a PostgreSQL

Esta preparación utiliza **únicamente las 173 filas visibles** del Excel `Items - 30.10.12 --.xlsx`.
No se cargan las filas ocultas por el filtro.

## Qué se preparó

- 173 productos.
- 19 marcas normalizadas.
- 13 categorías iniciales.
- `stock`, `minStock` y `maxStock` ajustados a niveles de arranque más razonables según el tipo de repuesto.
- 45 precios en C$ cuando fue posible relacionarlos con suficiente confianza con `Listado-Precio...xlsx`.
- 115 productos con una imagen local del catálogo asignada (exacta, de familia o de marca).
- 91 imágenes del Excel de catálogo copiadas a `frontend/public/product-images/catalogo/` para continuar completando asociaciones sin depender de hotlinks externos.

> Los stocks son valores sugeridos para una carga inicial/demo y **no sustituyen un conteo físico real**.
> Los costos promedio (`avgCost`) no se inventan: la entrada inicial usa costo 0 hasta que existan costos de compra reales.

## Cambio necesario para imágenes

El modelo Prisma ya tenía `Product.imageUrl`, pero el DTO/servicio de productos no aceptaba ese campo. Se añadió soporte en:

- `backend/src/products/dto/product.dto.ts`
- `backend/src/products/products.service.ts`
- formularios/mappers del frontend.

## Orden recomendado

### 1. Preparar PostgreSQL

Desde `backend`:

```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

El `prisma:seed` crea, entre otras cosas, el usuario administrador base que requiere la carga por API.

### 2. Iniciar el backend

```powershell
npm run start:dev
```

### 3. En otra terminal, cargar los productos

```powershell
cd backend
$env:SEED_ADMIN_PASSWORD="TU_CONTRASEÑA_ADMIN"
npm run seed:real
```

Opcionalmente, si la API corre en otra dirección:

```powershell
$env:API_URL="http://localhost:3000/api/v1"
```

## Si ya existen productos

Por defecto el script:

- actualiza sus datos maestros;
- actualiza imágenes;
- actualiza precios sustentados por el listado;
- **NO modifica el stock existente**.

Esto evita destruir un inventario que ya haya comenzado a usarse.

Solo en una base de demostración o cuando se quiera reemplazar expresamente el stock por el valor sugerido:

```powershell
$env:SEED_FORCE_STOCK="true"
npm run seed:real
```

El cambio se registra como `ADJUSTMENT`, de modo que queda trazabilidad en inventario.

## Archivos de datos

- `backend/scripts/data/norcor-products.json`: fuente lista para el script.
- `backend/scripts/seed-real-products.mjs`: cargador por API.
- `frontend/public/product-images/catalogo/`: imágenes extraídas del Excel de catálogo.

## Por qué la carga se hace por API

El backend de DAISY establece que el stock y el costo promedio cambien mediante movimientos de inventario. La carga usa los endpoints del sistema para respetar esas reglas y evitar insertar directamente un valor de `products.stock` que no tenga movimiento asociado.
