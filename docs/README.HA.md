# ThreeLinker High Availability (HA) Setup

Implementación completa de alta disponibilidad para ThreeLinker con Redis, load balancer nginx, failover automático, y sticky sessions por roomId.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐
│   nginx:80      │    │   Redis:6379    │
│   Load Balancer │    │   Shared State  │  
│   Static Files  │    │   Cache Store   │
└─────────┬───────┘    └─────────────────┘
          │                       ▲
          ▼                       │
┌─────────────────┐              │
│  Vite Frontend  │              │ Redis Adapter
│  Static Build   │              │ Sync Events  
└─────────────────┘              │
          │                       │
          ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Socket.IO:3001  │◄──►│ Socket.IO:3002  │
│ Instance 1      │    │ Instance 2      │
│ (Primary)       │    │ (Backup)        │
└─────────────────┘    └─────────────────┘
```

## 🚀 Inicio Rápido

### Método 1: Docker Compose (Recomendado)

```bash
# Clonar y navegar al proyecto
git clone <repository>
cd three-linker

# Iniciar stack completa de HA
./scripts/deploy-ha.sh start

# Verificar estado
./scripts/deploy-ha.sh status

# Ver logs
./scripts/deploy-ha.sh logs

# Acceder a la aplicación
open http://localhost
```

### Método 2: Desarrollo Local

```bash
# Instalar dependencias 
npm install

# Iniciar Redis (requiere Redis instalado localmente)
redis-server

# Iniciar servidores duales + frontend
npm run dev:ha
```

## 📋 Servicios Incluidos

| Servicio | Puerto | Descripción | Health Check |
|----------|--------|-------------|--------------|
| **nginx** | 80 | Load balancer + static files | `http://localhost/nginx_status` |
| **Frontend** | - | Vite build servido por nginx | `http://localhost` |
| **Server 1** | 3001 | Socket.IO primary instance | `http://localhost:3001/api/health` |
| **Server 2** | 3002 | Socket.IO backup instance | `http://localhost:3002/api/health` |
| **Redis** | 6379 | Shared state store | `redis-cli ping` |
| **Redis Insight** | 8001 | Redis monitoring (opcional) | `http://localhost:8001` |

## 🔧 Configuración

### Variables de Entorno

```bash
# Copiar configuración de HA
cp .env.ha .env

# Editar configuración según necesidades
nano .env
```

### Configuración de nginx

```nginx
# nginx/nginx.conf - Sticky sessions por roomId
upstream threelinker_backend {
    hash $arg_roomId consistent;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s backup;
}
```

### Configuración de Redis

```javascript
// Configuración automática con fallback a memoria
const redisManager = new RedisManager({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  // Fallback automático a memoria si Redis falla
  fallbackToMemory: true
});
```

## 🎯 Sticky Sessions por roomId

El sistema implementa sticky sessions basado en `roomId` para garantizar que todos los usuarios de una sala se conecten al mismo servidor:

```javascript
// Cliente - Cálculo automático del servidor
const targetServer = this.getServerForRoomId(roomId);

// nginx - Hash consistente por roomId  
hash $arg_roomId consistent;

// Servidor - Validación de routing
if (targetServer.port !== PORT) {
  return next(new Error(`REDIRECT:${targetServer.url}`));
}
```

## 🔄 Failover Automático

### Cliente (CollaborationManager.js)

```javascript
const serverUrls = [
  "http://localhost:3001",
  "http://localhost:3002"  
];

// Failover automático con preservación de estado
tryNextServer() {
  this.currentServerIndex = (this.currentServerIndex + 1) % this.serverUrls.length;
  this.connectToServer();
}
```

### Servidor (Redis Adapter)

```javascript
// Sincronización de eventos entre instancias
io.adapter(createAdapter(pubClient, subClient));

// Estado compartido en Redis
await redis.set(`room:${roomId}`, roomData, TTL.ROOM);
```

## 📊 Monitoreo

### Health Checks

```bash
# Verificar todos los servicios
curl http://localhost/api/health
curl http://localhost:3001/api/health  
curl http://localhost:3002/api/health

# Estadísticas detalladas
curl http://localhost/api/stats
curl http://localhost:3001/api/stats
curl http://localhost:3002/api/stats
```

### Logs

```bash
# Ver logs de todos los servicios
./scripts/deploy-ha.sh logs

# Logs específicos de nginx
docker logs threelinker-nginx

# Logs específicos de Redis
docker logs threelinker-redis
```

### Redis Insight (Opcional)

```bash
# Iniciar con monitoring
./scripts/deploy-ha.sh start monitor

# Acceder a Redis Insight
open http://localhost:8001
```

## 🛠️ Scripts de Gestión

### deploy-ha.sh

```bash
# Comandos principales
./scripts/deploy-ha.sh start     # Iniciar stack
./scripts/deploy-ha.sh stop      # Parar stack  
./scripts/deploy-ha.sh restart   # Reiniciar
./scripts/deploy-ha.sh status    # Ver estado
./scripts/deploy-ha.sh logs      # Ver logs
./scripts/deploy-ha.sh clean     # Limpiar todo

# Opciones
./scripts/deploy-ha.sh start --force     # Forzar recreación
./scripts/deploy-ha.sh start monitor    # Incluir monitoring
```

### build-for-nginx.sh

```bash
# Build optimizado para nginx
./scripts/build-for-nginx.sh

# Resultado: archivos en /var/www/threelinker
```

## 📈 Comandos NPM

```bash
# Desarrollo HA local
npm run dev:ha           # Dual servers + frontend
npm run server:3001      # Solo servidor 1  
npm run server:3002      # Solo servidor 2

# Docker shortcuts
npm run docker:start     # Iniciar stack
npm run docker:stop      # Parar stack
npm run docker:status    # Ver estado
npm run docker:logs      # Ver logs

# Build para nginx
npm run build:nginx      # Build + deploy a nginx
```

## 🔒 Seguridad

### Rate Limiting

```nginx
# nginx - Protección contra ataques
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=websocket:10m rate=20r/s;
```

### CORS Configuration

```javascript
// Configuración CORS para múltiples orígenes
cors: {
  origin: process.env.CORS_ORIGINS.split(','),
  methods: ["GET", "POST"]
}
```

## 🚨 Troubleshooting

### Puerto 80 Ocupado

```bash
# Parar nginx existente
sudo systemctl stop nginx

# Verificar puertos disponibles
./scripts/deploy-ha.sh status
```

### Redis No Conecta

```bash
# Verificar Redis container
docker logs threelinker-redis

# Conexión manual
redis-cli -h localhost -p 6379 ping
```

### Servidores No Sincronizan

```bash
# Verificar Redis Adapter
docker logs threelinker-server-1
docker logs threelinker-server-2

# Verificar eventos en Redis
redis-cli monitor
```

### nginx No Sirve Archivos

```bash
# Verificar volumen de archivos estáticos
docker exec threelinker-nginx ls -la /var/www/threelinker

# Reconstruir frontend
docker-compose -f docker-compose.ha.yml up --force-recreate frontend-builder
```

## 🎯 Performance Tips

### Optimizaciones de nginx

```nginx
# Keepalive para backends
upstream threelinker_backend {
    keepalive 32;
}

# Compresión optimizada
gzip_comp_level 6;
gzip_types text/plain application/json application/javascript;

# Cache para assets estáticos  
expires 1y;
add_header Cache-Control "public, immutable";
```

### Optimizaciones de Redis

```bash
# Redis configuration
maxmemory 256mb
maxmemory-policy allkeys-lru
appendfsync everysec
```

### Optimizaciones de Socket.IO

```javascript
// Timeouts optimizados
pingTimeout: 30000,
pingInterval: 15000,
maxHttpBufferSize: 10e6
```

## 📝 Notas de Desarrollo

- **Sticky Sessions**: Garantiza que usuarios de la misma sala se conecten al mismo servidor
- **Redis Fallback**: Si Redis falla, el sistema continúa funcionando en modo memoria
- **Health Checks**: Todos los servicios tienen health checks automáticos  
- **Logs Centralizados**: Logs con rotación automática y límites de tamaño
- **Zero Downtime**: Deployment sin interrumpir sesiones activas

## 🔗 Enlaces Útiles

- **Aplicación**: http://localhost
- **Health Check**: http://localhost/api/health
- **nginx Status**: http://localhost/nginx_status  
- **Redis Insight**: http://localhost:8001
- **Server 1 API**: http://localhost:3001/api/health
- **Server 2 API**: http://localhost:3002/api/health