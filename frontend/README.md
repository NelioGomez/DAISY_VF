# NORCOR FUELING SYSTEM — Frontend

Cliente web del Sistema de Gestión de Ventas e Inventario de NORCOR, construido con
**React 19 + TypeScript + Vite** según el *Análisis tecnológico backend/frontend*.

Todos los datos vienen de la API NestJS (`/api/v1`): sesión con JWT, permisos por rol,
inventario, ventas, cobros, órdenes OPI, auditoría y catálogo público. Las reglas de negocio
(stock, costo promedio, IVA, créditos, transiciones de estado) las aplica el servidor.

## Requisitos

- **Node.js 22 LTS** (mínimo 20.19) y npm. Verificar con `node -v`.

## Cómo levantarlo (backend + frontend)

Se necesitan las dos partes corriendo a la vez, cada una en su terminal.

**1. Backend** (repositorio `DAISY_VF/backend`, requiere PostgreSQL 16):

```bash
cd backend
npm install
# .env: DATABASE_URL, JWT_SECRET, SEED_ADMIN_PASSWORD y CORS_ORIGIN
#   - Si la contraseña lleva "#", va entre comillas: SEED_ADMIN_PASSWORD="Siven#Admin2026"
#   - CORS_ORIGIN debe incluir http://localhost:5173
#   - Para probar con calma: JWT_EXPIRES_IN=8h (por defecto la sesión dura 15 min)
npx prisma migrate deploy
npx prisma db seed               # roles, permisos y usuario admin
npm run start:dev                # API en http://localhost:3000/api/v1
node scripts/seed-demo.mjs       # (otra terminal, con la API corriendo) usuarios y datos de prueba
```

**2. Frontend:**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

En desarrollo Vite reenvía `/api` a `http://localhost:3000` (ver `vite.config.ts`), así que no hay
problemas de CORS. Si la API corre en otro puerto o equipo, definir `VITE_BACKEND_URL` en `.env`.

| Comando           | Qué hace                                              |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Desarrollo con recarga en caliente                     |
| `npm run build`   | Verifica tipos (tsc) y genera `dist/` para producción |
| `npm run preview` | Sirve localmente el build de `dist/` (también con proxy) |
| `npm run lint`    | Revisa el código con oxlint                           |

Variables (`.env.example`): `VITE_API_URL` (por defecto `/api/v1`), `VITE_BACKEND_URL` (destino
del proxy) y `VITE_DEMO_ACCOUNTS` (muestra el panel de cuentas de prueba fuera de `npm run dev`).

## Cuentas de prueba

| Usuario    | Rol            | Contraseña                         |
| ---------- | -------------- | ---------------------------------- |
| `admin`    | Administrador  | la de `SEED_ADMIN_PASSWORD`        |
| `gerencia` | Gerencia       | `Siven2026demo`                    |
| `jflores`  | Vendedor       | `Siven2026demo`                    |
| `ngomez`   | Inventario     | `Siven2026demo`                    |
| `eurcuyo`  | Contabilidad   | `Siven2026demo`                    |
| `tlopez`   | Técnico OPI    | `Siven2026demo`                    |

El menú de cada usuario sale de sus permisos reales en el servidor.

## Inicio de sesión y seguridad

- Mensaje genérico ante credenciales incorrectas, sin revelar si el usuario existe.
- El servidor limita a 5 intentos por minuto por IP; la pantalla avisa cuando quedan 2 o menos y
  muestra la cuenta regresiva del bloqueo (cabeceras `X-RateLimit-*` / `Retry-After`).
- El token vive solo en `sessionStorage` (se pierde al cerrar la pestaña). Al recargar se valida
  con `GET /auth/me`; si el servidor lo rechaza, se vuelve al login con aviso y el usuario precargado.
- Cierre automático tras 15 min sin actividad y al vencer el JWT.
- Toda operación queda en la bitácora de Auditoría del servidor.

### Recuperación de contraseña (`/recuperar`)

Tres pasos: correo → código de 6 dígitos → contraseña nueva. El frontend llama primero a
`/auth/forgot-password`, `/auth/verify-reset-code` y `/auth/reset-password` (contrato y guía en
`docs/recuperacion-contrasena.md`). **El backend todavía no tiene esos endpoints**, así que:

- en desarrollo se usa una simulación: el código aparece en pantalla y la contraseña real no cambia
  (se avisa al terminar);
- en producción se indica que la recuperación no está disponible y que lo resuelva el administrador.
Variables de entorno: copiar `.env.example` como `.env`. `VITE_API_URL` apunta a la API NestJS
(aún no se consume).

## Inicio de sesión

El rol lo define la cuenta, no se elige en pantalla. En desarrollo (`npm run dev`) el login muestra
un panel **Cuentas de prueba** (contraseña `Siven#2026`); fuera de desarrollo solo aparece con
`VITE_DEMO_ACCOUNTS=true` en `.env`.

Medidas aplicadas en el cliente (`config/security.ts`, `services/auth/authService.ts`):

- Mensaje genérico ante credenciales incorrectas, sin revelar si el usuario existe.
- 5 intentos fallidos → bloqueo temporal de 60 s con cuenta regresiva.
- Intentos fallidos, bloqueos y cierres de sesión quedan en Auditoría.
- La contraseña se borra tras un fallo y nunca se recuerda; "Recordar mi usuario" guarda solo el nombre.
- Cierre automático tras 15 min sin actividad, con aviso y regreso a la vista anterior.

### Recuperación de contraseña (`/recuperar`)

Tres pasos: correo → código de 6 dígitos → contraseña nueva. La respuesta al pedir el código es
igual exista o no el correo; el código vence a los 10 min, admite 5 intentos y se reenvía cada
60 s (máximo 3 por correo cada 15 min). La contraseña nueva debe cumplir la política de
`utils/passwordPolicy.ts`. La cuenta `ngomez` usa el correo de pruebas `ngomezanderson@gmail.com`.

El correo real lo envía el backend (guía y plantilla en `docs/` en la raíz del repo). Mientras
no exista ese endpoint, en desarrollo el código se muestra en pantalla.

Pendiente en NestJS (lo que realmente protege): contraseñas con hash argon2/bcrypt, límite de
intentos en el servidor (`@nestjs/throttler`), JWT en cookie `httpOnly` + `Secure` + `SameSite` y HTTPS.

## Rutas

| Ruta            | Vista                                        |
| --------------- | -------------------------------------------- |
| `/login`        | Inicio de sesión del personal                |
| `/recuperar`    | Recuperación de contraseña en 3 pasos        |
| `/catalogo`     | Catálogo público (sin sesión)                |
| `/app/<módulo>` | Panel interno (dashboard, productos, ventas…) |

## Estructura

```
src/
  app/
    providers/      Router + Store + Toasts + Modales
    router/         Rutas y guards (sesión y permisos por rol)
  components/       Piezas reutilizables sin lógica de dominio
    cards/          KpiCard
    charts/         BarChart
    common/         Logo, ViewHead, AccessDenied
    feedback/       Toasts, estados vacíos
    forms/          Field, InputField, LineEditor (cotizaciones/ventas)
    modals/         Modal y gestor de modales
    tables/         Tag, EstadoTag, SearchToolbar
  config/
    business.ts     Reglas configurables (IVA, categorías, flujo OPI…)
    navigation.ts   Roles, permisos visuales, menú y títulos
  features/         Un folder por módulo de negocio (página + modales)
  layouts/          DashboardLayout (sidebar + topbar)
  services/
    api/client.ts   Cliente HTTP (token, errores, paginación)
    api/mappers.ts  Traduce la respuesta de la API a los tipos del frontend
    auth/           Login, sesión y recuperación de contraseña
    mock/users.ts   Solo para la simulación de recuperación
  store/            Carga de datos por permisos, acciones y hooks useAuth / useData
  styles/           CSS global (identidad visual original)
  types/            Tipos de dominio
  utils/            Formato, CSV, cálculo de documentos
```

## Cómo está organizada la lógica

- Los componentes **no llaman a la API directamente**: usan acciones de `useData()`
  (`confirmarVenta`, `registrarMovimiento`, `registrarPago`…), que devuelven `{ ok, data | error }`.
- Las acciones viven en `store/StoreProvider.tsx`: llaman a la API y, al terminar, recargan solo
  las colecciones afectadas (por ejemplo, una venta refresca ventas, stock, cobros y dashboard).
- Al iniciar sesión se cargan solo las colecciones que el rol puede leer.
- Ocultar botones por rol es solo comodidad visual; la autorización real la hacen los guards de NestJS.
