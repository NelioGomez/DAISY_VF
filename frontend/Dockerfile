# ---------- compilación ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# URL pública de la API, p. ej. https://backend-production-xxxx.up.railway.app/api/v1
ARG VITE_API_URL=/api/v1
# Servidor de WebSocket (socket.io) = dominio del backend, sin /api/v1
ARG VITE_WS_URL
# Opcionales: dominios separados para sitio público y sistema interno
ARG VITE_SITE_URL
ARG VITE_SYSTEM_URL
# "true" muestra las cuentas de prueba en el login (solo para la defensa)
ARG VITE_DEMO_ACCOUNTS=false

# Se muestran en el log del build para comprobar qué URL quedó compilada.
RUN echo "VITE_API_URL=${VITE_API_URL}" && echo "VITE_WS_URL=${VITE_WS_URL}" \
 && npm run build

# ---------- servidor estático ----------
FROM nginx:stable-alpine AS runtime

# Nginx escucha en $PORT (Railway). La imagen oficial sustituye ${PORT} en
# /etc/nginx/templates/*.template al arrancar.
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080