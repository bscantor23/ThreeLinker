/**
 * Configuración para instancias del servidor
 */

// Configuración específica por instancia del servidor
export const SERVER_CONFIG = {
  // Instancia 1 (puerto 3001)
  instance1: {
    PORT: 3001,
    INSTANCE_ID: 'server-1',
    REDIS_KEY_PREFIX: 'linker:',
    HEALTH_ENDPOINT: '/health/server-1'
  },

  // Instancia 2 (puerto 3002) 
  instance2: {
    PORT: 3002,
    INSTANCE_ID: 'server-2',
    REDIS_KEY_PREFIX: 'linker:',
    HEALTH_ENDPOINT: '/health/server-2'
  }
};

// Configuración de Redis
export const REDIS_CONFIG = {
  // TTL configurations (en segundos)
  TTL: {
    ROOM: 24 * 60 * 60,      // 24 horas para salas
    USER: 60 * 60,           // 1 hora para usuarios
    EDITOR: 2 * 60 * 60,     // 2 horas para editor data
    SESSION: 5 * 60,         // 5 minutos para sesiones de failover
  },

  // Prefijos de claves
  KEYS: {
    ROOM: 'room:',
    USER: 'user:',
    EDITOR: 'editor:',
    SESSION: 'session:',
    STATS: 'stats:',
    ROOM_USERS: 'room_users:',
    USER_ROOM: 'user_room:'
  }
};

// Configuración de balanceador por roomId
export const LOAD_BALANCER_CONFIG = {
  SERVERS: (() => {
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = process.env.BASE_URL || 'https://linker.genodev.com.co';

    if (isProduction) {
      // En producción, ambos servidores comparten el mismo dominio público
      // Nginx maneja el routing interno
      return [
        {
          url: baseUrl,
          port: 3001,
          id: 'server-1'
        },
        {
          url: baseUrl,
          port: 3002,
          id: 'server-2'
        }
      ];
    } else {
      // En desarrollo, usar localhost con puertos diferentes
      return [
        {
          url: 'http://localhost:3001',
          port: 3001,
          id: 'server-1'
        },
        {
          url: 'http://localhost:3002',
          port: 3002,
          id: 'server-2'
        }
      ];
    }
  })(),

  // Función para calcular servidor por roomId
  getServerForRoom: (roomId) => {
    // Hash simple por roomId para distribución consistente
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const serverIndex = Math.abs(hash) % LOAD_BALANCER_CONFIG.SERVERS.length;
    return LOAD_BALANCER_CONFIG.SERVERS[serverIndex];
  }
};

// Variables de entorno con valores por defecto
export const ENV_CONFIG = {
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || null,
  REDIS_DB: parseInt(process.env.REDIS_DB) || 0,

  // Servidor
  PORT: parseInt(process.env.PORT) || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  INSTANCE_ID: process.env.INSTANCE_ID || 'server-1',

  // Frontend
  VITE_SERVER_URL: process.env.VITE_SERVER_URL || 'http://localhost:3001',

  // Timeouts
  CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL) || 300000, // 5 min
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30s

  // Debug
  DEBUG: process.env.DEBUG || false
};

export default {
  SERVER_CONFIG,
  REDIS_CONFIG,
  LOAD_BALANCER_CONFIG,
  ENV_CONFIG
};