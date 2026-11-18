# Guía de trabajo en equipo (Git / GitHub)

## Ramas

| Rama        | Para qué                                                       | Quién escribe     |
| ----------- | -------------------------------------------------------------- | ----------------- |
| `main`      | Versión estable / entregable. Solo recibe merges de `develop`. | Nadie directo     |
| `develop`   | Integración del equipo. Aquí se juntan las features.           | Solo vía Pull Request |
| `feature/*` | Una mejora o módulo nuevo                                      | Cada integrante   |
| `fix/*`     | Corrección de un error                                         | Cada integrante   |

Nombres sugeridos según el análisis de mejoras UX:

- `fix/p0-coherencia` — IVA configurable, alta de producto sin costo/precio/stock, solicitudes auditables
- `feature/compras-reabastecimiento` — módulo de Compras, recepción y panel de reposición
- `feature/portal-clientes` — login de clientes, lista de solicitud, conversión a cotización
- `feature/venta-pos` — venta tipo POS con disponibilidad
- `feature/dashboard-roles` — dashboards por rol y centro de notificaciones

## Flujo diario

```bash
# 1. Partir siempre de develop actualizado
git checkout develop
git pull origin develop

# 2. Crear tu rama
git checkout -b feature/nombre-corto

# 3. Trabajar y hacer commits pequeños
git add .
git commit -m "feat(compras): tabla de compras pendientes"

# 4. Antes de subir, traer lo último de develop
git pull origin develop        # resolver conflictos si aparecen
npm run build && npm run lint  # debe pasar sin errores

# 5. Subir la rama y abrir un Pull Request hacia develop en GitHub
git push -u origin feature/nombre-corto
```

Otra persona del equipo revisa y aprueba el PR antes de hacer merge. Después del merge se
borra la rama.

## Mensajes de commit

Formato: `tipo(área): descripción en presente`

- `feat` funcionalidad nueva · `fix` corrección · `refactor` reorganización sin cambio de comportamiento
- `style` solo estilos · `docs` documentación · `chore` dependencias/configuración

## Reglas del proyecto

- No subir `node_modules/`, `dist/` ni `.env` (ya están en `.gitignore`).
- Si agregas una dependencia, sube también `package-lock.json`.
- Reglas de negocio nuevas: en `store/` (hoy) o en el backend (cuando el módulo use la API), nunca dentro de un componente.
- Componentes reutilizables en `components/`; lo propio de un módulo en `features/<módulo>/`.
