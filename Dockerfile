# Dockerfile unificado para ThreeLinker con multi-stage builds

FROM node:22-alpine AS base

# ==========================
# Base común
# ==========================
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

# ==========================
# STAGE: Development (Vite dev server)
# ==========================
FROM base AS development

# Entorno de desarrollo
ENV NODE_ENV=development

# Instalar TODAS las dependencias (incluye devDependencies, donde está Vite)
RUN npm ci --verbose || npm install --verbose

# Copiar todo el código fuente
COPY . .

# Vite por defecto usa 5173
EXPOSE 5173

# Comando por defecto: servidor de desarrollo
CMD ["npm", "run", "dev"]

# ==========================
# STAGE: Frontend Builder (build de Vite)
# ==========================
FROM base AS frontend-builder

# Entorno de build
ENV NODE_ENV=production

# Instalar TODAS las dependencias (necesitamos Vite para el build)
RUN npm ci --verbose || npm install --verbose

# Copiar código fuente
COPY . .

# Variables de entorno para el build
ARG VITE_SERVER_URL=http://localhost
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

# Build optimizado del frontend
RUN echo "🏗️ Iniciando build de Vite..." && \
    npm run build && \
    echo "📊 Estadísticas del build:" && \
    ls -la dist/ && \
    du -sh dist/

# ==========================
# STAGE: Server Runtime (backend Node)
# ==========================
FROM base AS server

# Entorno de producción
ENV NODE_ENV=production

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

# ==========================
# STAGE: Frontend Runtime (para servir dist con nginx externo)
# ==========================
FROM frontend-builder AS frontend

# Crear directorio para volumen compartido
RUN mkdir -p /app/dist && \
    chown -R threelinker:nodejs /app
USER threelinker

# Contenedor "dummy" para exponer /app/dist a nginx (via volume)
CMD ["sh", "-c", "echo '📦 Frontend build listo para nginx' && tail -f /dev/null"]
