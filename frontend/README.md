# NORCOR FUELING SYSTEM — Frontend

Cliente web del Sistema de Gestión de Ventas e Inventario de NORCOR, construido con
**React 19 + TypeScript + Vite** según el *Análisis tecnológico backend/frontend*.

Esta versión (`v1.0.0`) es la **migración 1:1 del prototipo `Index.html`**: mismos módulos,
roles, datos semilla, reglas y estilos. Las mejoras del *Análisis de mejoras UX* se
implementan después, en ramas separadas (ver `CONTRIBUTING.md`).

## Requisitos

- **Node.js 22 LTS** (mínimo 20.19) y npm. Verificar con `node -v`.

## Instalación y uso

```bash
cd frontend
npm install          # instala dependencias desde package.json / package-lock.json
npm run dev          # servidor de desarrollo → http://localhost:5173
```

| Comando           | Qué hace                                              |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Desarrollo con recarga en caliente                     |
| `npm run build`   | Verifica tipos (tsc) y genera `dist/` para producción |
| `npm run preview` | Sirve localmente el build de `dist/`                  |
| `npm run lint`    | Revisa el código con oxlint                           |

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

Pendiente en NestJS (lo que realmente protege): contraseñas con hash argon2/bcrypt, límite de
intentos en el servidor (`@nestjs/throttler`), JWT en cookie `httpOnly` + `Secure` + `SameSite` y HTTPS.

## Rutas

| Ruta            | Vista                                        |
| --------------- | -------------------------------------------- |
| `/login`        | Inicio de sesión del personal                |
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
    api/client.ts   Cliente HTTP para NestJS (listo, aún sin uso)
    mock/seed.ts    Datos semilla del prototipo
  store/            Capa de datos simulada y hooks useAuth / useData
  styles/           CSS global (identidad visual original)
  types/            Tipos de dominio
  utils/            Formato, CSV, cálculo de documentos
```

## Cómo está organizada la lógica

- Los componentes **no modifican datos directamente**: llaman acciones de `useData()`
  (`confirmarVenta`, `registrarMovimiento`, `registrarPago`…), que devuelven `{ ok, data | error }`.
- Hoy esas acciones viven en `store/StoreProvider.tsx` y trabajan en memoria (igual que el
  prototipo: al recargar la página se reinician los datos y la sesión).
- **Para conectar un módulo a NestJS**: reemplazar su acción por una llamada en `services/api`
  y mover la regla de negocio al backend. Las páginas no deberían cambiar.
- Ocultar módulos por rol es solo visual; la autorización real va en NestJS (guards).

## Pendientes conocidos (P0 del análisis UX)

Se conservaron a propósito para que esta versión sea fiel al prototipo:

- IVA 15 % aplicado en cotizaciones y facturas → centralizado en `config/business.ts`.
- El alta de producto permite editar costo, precio y stock inicial.
- Las consultas web se marcan como "Atendida" sin generar cotización.
