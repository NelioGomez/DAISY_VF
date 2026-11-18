# ---------- base común ----------
FROM node:22-slim AS base
# OpenSSL lo usa el motor de migraciones de Prisma (schema-engine).
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV CHECKPOINT_DISABLE=1

# ---------- compilación ----------
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# prisma.config.ts exige DATABASE_URL aunque "generate" no se conecta a nada:
# se usa un valor ficticio solo para este paso (no queda en la imagen final).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && npm run build

# ---------- dependencias de producción ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
# Incluye el CLI de Prisma (peer de @prisma/client), necesario para "migrate deploy".
RUN npm ci --omit=dev --no-audit --no-fund \
 && node_modules/.bin/prisma --version \
 && npm cache clean --force
# "prisma --version" descarga el schema-engine ahora (en el build, con internet),
# así el contenedor no tiene que bajarlo al arrancar.

# ---------- imagen final ----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
# Plantilla del correo de recuperación de contraseña (se lee desde process.cwd()/templates).
COPY templates ./templates

# Carpeta de fotos de productos. En Railway se monta un Volume aquí (/app/uploads).
RUN mkdir -p /app/uploads/products && chown -R node:node /app/uploads

# Usuario sin privilegios. Si monta un Volume en Railway, agregue RAILWAY_RUN_UID=0
# (los volúmenes se montan como root).
USER node

EXPOSE 3000

# 1) aplica migraciones pendientes  2) arranca la API (exec: Node recibe las señales de apagado)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
