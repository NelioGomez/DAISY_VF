#!/bin/sh
# =====================================================================
# Pre-deploy de Railway (Settings → Deploy → Pre-deploy Command: sh predeploy.sh)
# Corre una vez por despliegue, antes de poner en línea la versión nueva.
# Tiene las variables del servicio y la red privada (llega a Postgres).
# Si algo falla, el despliegue se cancela y sigue la versión anterior.
# =====================================================================
set -e

echo "→ Aplicando migraciones pendientes"
node_modules/.bin/prisma migrate deploy

# Seed base: roles, permisos, usuario admin y configuración inicial.
# Es seguro repetirlo (no duplica ni cambia la contraseña del admin), PERO vuelve a
# agregar a cada rol los permisos por defecto que se le hayan quitado desde el panel.
# Por eso solo corre si SEED_ON_DEPLOY=true: actívelo en una base nueva (o en un
# entorno de pruebas) y en producción desactívelo después del primer despliegue.
if [ "$SEED_ON_DEPLOY" = "true" ]; then
  echo "→ SEED_ON_DEPLOY=true: cargando datos base"
  node dist/seed.js
else
  echo "→ Seed base omitido (SEED_ON_DEPLOY no es true)"
fi
