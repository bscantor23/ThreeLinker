/**
 * Servidor Unificado ThreeLinker - Multi-instancia
 * Socket.IO con Redis Adapter para alta disponibilidad
 * Configuración automática según variables de entorno
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import path from "path";
import { fileURLToPath } from "url";

import { setupCollaborationServer } from "./server/collaborationServer.js";
import RedisManager from "./server/managers/RedisManager.js";
import { SERVER_CONFIG, ENV_CONFIG, LOAD_BALANCER_CONFIG } from "./server/config/serverConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración dinámica según variables de entorno
const PORT = parseInt(process.env.PORT) || ENV_CONFIG.PORT;
const INSTANCE_ID = process.env.INSTANCE_ID || ENV_CONFIG.INSTANCE_ID;

// Determinar configuración de instancia automáticamente
let instanceConfig;
if (PORT === 3001 || INSTANCE_ID === 'server-1') {
  instanceConfig = SERVER_CONFIG.instance1;
} else if (PORT === 3002 || INSTANCE_ID === 'server-2') {
  instanceConfig = SERVER_CONFIG.instance2;
} else {
  // Configuración por defecto para puertos personalizados
  instanceConfig = {
    PORT: PORT,
    INSTANCE_ID: INSTANCE_ID || `server-${PORT}`,
    REDIS_KEY_PREFIX: 'threelinker:',
    HEALTH_ENDPOINT: `/health/${INSTANCE_ID || `server-${PORT}`}`
  };
}

const app = express();
const server = createServer(app);

console.log(`🚀 Iniciando ${instanceConfig.INSTANCE_ID} en puerto ${instanceConfig.PORT}`);
console.log(`🔧 Configuración:`, {
  port: instanceConfig.PORT,
  instanceId: instanceConfig.INSTANCE_ID,
  nodeEnv: process.env.NODE_ENV || 'development',
  redisHost: ENV_CONFIG.REDIS_HOST,
  redisPort: ENV_CONFIG.REDIS_PORT
});

// Configurar Redis Adapter para Socket.IO
async function setupRedisAdapter() {
  try {
    // Formato URL correcto para Redis v4+
    const redisUrl = `redis://${ENV_CONFIG.REDIS_HOST}:${ENV_CONFIG.REDIS_PORT}`;
    if (ENV_CONFIG.REDIS_PASSWORD) {
      redisUrl.replace('redis://', `redis://:${ENV_CONFIG.REDIS_PASSWORD}@`);
    }
    
    const pubClient = createClient({
      url: redisUrl,
      db: ENV_CONFIG.REDIS_DB
    });

    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    console.log(`✅ Redis Adapter conectado para ${instanceConfig.INSTANCE_ID}`);
    
    return createAdapter(pubClient, subClient);
  } catch (error) {
    console.warn(`⚠️  Redis Adapter falló para ${instanceConfig.INSTANCE_ID}, continuando sin adapter:`, error.message);
    return null;
  }
}

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://threelinker.genodev.com.co",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 10e6, // 10MB
  pingTimeout: ENV_CONFIG.SOCKET_TIMEOUT || 60000,
  pingInterval: 25000,
  connectTimeout: ENV_CONFIG.CONNECTION_TIMEOUT || 60000,
  allowEIO3: true,
  transports: ['websocket', 'polling'],
});

// Aplicar Redis Adapter
setupRedisAdapter().then(adapter => {
  if (adapter) {
    io.adapter(adapter);
    console.log(`📡 ${instanceConfig.INSTANCE_ID} configurado con Redis Adapter`);
  }
});

// Middleware para sticky sessions por roomId
io.use(async (socket, next) => {
  const roomId = socket.handshake.query.roomId;
  
  if (roomId) {
    // Verificar si este servidor debe manejar esta sala
    const targetServer = LOAD_BALANCER_CONFIG.getServerForRoom(roomId);
    
    if (targetServer.port !== instanceConfig.PORT) {
      console.log(`🔄 Redirigiendo sala ${roomId} de ${instanceConfig.INSTANCE_ID} a ${targetServer.id}`);
      return next(new Error(`REDIRECT:${targetServer.url}`));
    }
    
    console.log(`✅ ${instanceConfig.INSTANCE_ID} manejará sala ${roomId}`);
  }
  
  next();
});

// Crear RedisManager compartido
const redisManager = new RedisManager();

// Servir archivos estáticos
app.use(express.static(__dirname));

// Configurar sistema de colaboración con Redis
const collaboration = setupCollaborationServer(io, redisManager);

// Health check específico de instancia
app.get(instanceConfig.HEALTH_ENDPOINT, (req, res) => {
  const health = collaboration.utils.getHealth();
  const redisStats = redisManager.getStats();
  
  res.json({
    ...health,
    instance: instanceConfig.INSTANCE_ID,
    port: instanceConfig.PORT,
    redis: redisStats,
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Health check genérico
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    instance: instanceConfig.INSTANCE_ID,
    port: instanceConfig.PORT,
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Estadísticas con información de instancia
app.get('/api/stats', (req, res) => {
  const stats = collaboration.getStats();
  res.json({
    ...stats,
    instance: instanceConfig.INSTANCE_ID,
    port: instanceConfig.PORT,
    redis: redisManager.getStats(),
    config: {
      redisHost: ENV_CONFIG.REDIS_HOST,
      redisPort: ENV_CONFIG.REDIS_PORT,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// Endpoint para obtener todas las salas de todos los servidores
app.get('/api/all-rooms', async (req, res) => {
  try {
    const activeRooms = await roomManager.getActiveRooms();
    const serverInfo = {
      currentInstance: instanceConfig.INSTANCE_ID,
      currentPort: instanceConfig.PORT,
      servers: LOAD_BALANCER_CONFIG.SERVERS,
      algorithm: 'roomId hash'
    };
    
    res.json({
      success: true,
      rooms: activeRooms,
      serverInfo,
      timestamp: Date.now(),
      totalRooms: activeRooms.length
    });
  } catch (error) {
    console.error('Error obteniendo todas las salas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener salas de todos los servidores',
      details: error.message,
      timestamp: Date.now()
    });
  }
});

// Endpoint para obtener configuración de load balancer
app.get('/api/load-balancer', (req, res) => {
  res.json({
    currentInstance: instanceConfig.INSTANCE_ID,
    currentPort: instanceConfig.PORT,
    servers: LOAD_BALANCER_CONFIG.SERVERS,
    algorithm: 'roomId hash',
    instanceConfig: instanceConfig
  });
});

// Endpoint para información de la instancia
app.get('/api/instance', (req, res) => {
  res.json({
    ...instanceConfig,
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    timestamp: Date.now()
  });
});

// Iniciar servidor
server.listen(instanceConfig.PORT, () => {
  console.log(`🌟 ${instanceConfig.INSTANCE_ID} ejecutándose en http://localhost:${instanceConfig.PORT}`);
  console.log(`📊 Health check específico: http://localhost:${instanceConfig.PORT}${instanceConfig.HEALTH_ENDPOINT}`);
  console.log(`📊 Health check genérico: http://localhost:${instanceConfig.PORT}/api/health`);
  console.log(`📈 Estadísticas: http://localhost:${instanceConfig.PORT}/api/stats`);
  console.log(`🔄 Load balancer info: http://localhost:${instanceConfig.PORT}/api/load-balancer`);
  console.log(`ℹ️  Instance info: http://localhost:${instanceConfig.PORT}/api/instance`);
  
  console.log("Módulos cargados:", {
    redisManager: "✓",
    socketAdapter: "✓", 
    collaboration: "✓",
    instanceConfig: "✓"
  });
});

// Manejo de errores de conexión
io.engine.on("connection_error", (err) => {
  console.log(`❌ ${instanceConfig.INSTANCE_ID} - Error de conexión:`, err.req);
  console.log(`❌ ${instanceConfig.INSTANCE_ID} - Código:`, err.code);
  console.log(`❌ ${instanceConfig.INSTANCE_ID} - Mensaje:`, err.message);
  console.log(`❌ ${instanceConfig.INSTANCE_ID} - Context:`, err.context);
});

// Manejar cierre limpio del servidor
const shutdown = async () => {
  console.log(`\n🔄 Cerrando ${instanceConfig.INSTANCE_ID}...`);
  
  try {
    await collaboration.shutdown();
    await redisManager.shutdown();
    console.log(`✅ ${instanceConfig.INSTANCE_ID} cerrado correctamente`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error durante cierre de ${instanceConfig.INSTANCE_ID}:`, error);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Log de procesos no manejados
process.on('unhandledRejection', (reason, promise) => {
  console.error(`❌ ${instanceConfig.INSTANCE_ID} - Unhandled Rejection at:`, promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error(`❌ ${instanceConfig.INSTANCE_ID} - Uncaught Exception:`, error);
  process.exit(1);
});

// Exportar para testing o uso programático
export { io, collaboration, redisManager, instanceConfig };