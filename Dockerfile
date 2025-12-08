# Dockerfile unificado para ThreeLinker con multi-stage builds
FROM node:22-alpine AS base

# Instalar herramientas del sistema
RUN apk add --no-cache \
    curl \
    netcat-openbsd \
    git \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S threelinker -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# =============================================================================
# STAGE: Frontend Builder
# =============================================================================
FROM base AS frontend-builder

# Instalar todas las dependencias (incluye devDependencies para Vite)
RUN npm ci --verbose || npm install --verbose

# Copiar código fuente
COPY . .

# Variables de entorno para el build
ARG VITE_SERVER_URL=http://localhost
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production

# Build optimizado del frontend
RUN echo "🏗️ Iniciando build de Vite..." && \
    npm run build && \
    echo "📊 Estadísticas del build:" && \
    ls -la dist/ && \
    du -sh dist/


# =============================================================================
# STAGE: Server Runtime
# =============================================================================
FROM base AS server

# Instalar solo dependencias de producción
RUN npm ci --only=production --verbose || npm install --only=production --verbose && \
    npm cache clean --force

# Copiar código fuente del servidor
COPY server/ ./server/
COPY server.js ./
COPY *.json ./

# Establecer permisos
RUN chown -R threelinker:nodejs /app
USER threelinker

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001
ENV INSTANCE_ID=server-1
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379
ENV REDIS_DB=0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Exponer puerto
EXPOSE ${PORT}

# Script de inicio con verificación de Redis
CMD sh -c " \
    echo '🚀 Iniciando ${INSTANCE_ID} en puerto ${PORT}...' && \
    echo '🔄 Verificando conexión Redis...' && \
    while ! nc -z ${REDIS_HOST} ${REDIS_PORT}; do \
        echo '⏳ Esperando Redis en ${REDIS_HOST}:${REDIS_PORT}...' && \
        sleep 2; \
    done && \
    echo '✅ Redis disponible, iniciando servidor...' && \
    exec node server.js \
    "

# =============================================================================
# STAGE: Frontend Runtime (solo para distribuir archivos estáticos)
# =============================================================================
FROM frontend-builder AS frontend

# Crear directorio para volumen compartido
RUN mkdir -p /app/dist && \
    chown -R threelinker:nodejs /app
USER threelinker

# Comando para mantener el contenedor activo y servir archivos
CMD ["sh", "-c", "echo '📦 Frontend build listo para nginx' && tail -f /dev/null"]

# =============================================================================
# STAGE: Development (modo completo con servidor + frontend)
# =============================================================================
FROM base AS development

# Instalar todas las dependencias (incluye devDependencies)
RUN npm install

# Copiar todo el código fuente
COPY . .

# Variables de entorno para desarrollo
ARG VITE_SERVER_URL=http://localhost:3001
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=development

# Exponer puertos para desarrollo
EXPOSE 3001 5173

# Ejecutar en modo desarrollo con concurrently
CMD ["npm", "run", "dev:full"]