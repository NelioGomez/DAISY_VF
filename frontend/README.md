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

## Tiempo real

Al iniciar sesión el frontend abre un WebSocket con la API (`services/realtime/realtime.ts`).
Cuando otro usuario cambia algo que usted puede ver (una venta, un movimiento de stock, una
consulta del catálogo público…), la vista se actualiza sola, sin recargar la página.

- En la barra superior, **En vivo** indica que el canal está activo. Si se cae la conexión
  muestra *Reconectando…*; al volver, recarga los datos por si se perdió algún aviso.
- Los cambios de otros usuarios se anuncian con un aviso. Un clic en *En vivo* los silencia
  (🔕); los datos se siguen actualizando igual. La preferencia queda guardada en el navegador.
- Los avisos de cambios propios no se repiten, y nadie recibe detalles de módulos que su rol no puede ver.
- En desarrollo Vite reenvía `/socket.io` al backend. Si el WebSocket está en otro servidor,
  definir `VITE_WS_URL`.

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

Tres pasos reales contra la API: correo → código de 6 dígitos → contraseña nueva
(`/auth/forgot-password`, `/auth/verify-reset-code`, `/auth/reset-password`). El código vence a los
10 min, admite 5 intentos y se reenvía cada 60 s; la contraseña nueva cumple la política de
`utils/passwordPolicy.ts` (el servidor valida la misma). Al cambiarla se cierran las sesiones
abiertas con la anterior. Sin SMTP configurado en el backend, el código aparece en su terminal.
Si el backend no tuviera esas rutas (404), en desarrollo se usa una simulación y se avisa.

### Otros cambios ligados a la base de datos

- **Login con usuario o correo** (ambos sin distinguir mayúsculas).
- **Impuesto desde la configuración** (`GET /settings`): en cuota fija las ventas y cotizaciones
  muestran "sin IVA"; si Administración activa el IVA, la vista previa lo calcula con esa tasa.
- **Precio comercial con historial:** botón *Precio* en Productos e Inventario para quien tiene
  `prices:write` (Administración, Gerencia). Inventario da de alta productos sin precio.
- **Solicitudes web** con código `SOL-000001` y estados Nueva → En revisión → Cotizada → Cerrada / Cancelada.

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
    realtime/       Cliente WebSocket (socket.io)
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
