/**
 * RedisManager - Gestor centralizado de Redis con pooling y fallback
 */
import Redis from 'ioredis';
import { logServerEvent } from '../utils/serverUtils.js';

class RedisManager {
  constructor(config = {}) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: true,
      ...config
    };

    this.redis = null;
    this.isConnected = false;
    this.fallbackToMemory = true;
    this.memoryCache = new Map();

    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      this.redis = new Redis(this.config);

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.fallbackToMemory = false;
        logServerEvent('REDIS_CONNECTED', null, {
          message: 'Conexión Redis establecida',
          host: this.config.host,
          port: this.config.port
        });
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        this.fallbackToMemory = true;
        logServerEvent('REDIS_ERROR', null, {
          message: 'Error Redis, usando memoria como fallback',
          error: error.message
        });
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        this.fallbackToMemory = true;
        logServerEvent('REDIS_DISCONNECTED', null, {
          message: 'Conexión Redis cerrada, usando memoria'
        });
      });

      // Intentar conexión inicial
      await this.redis.connect();

      // Inicializar conexión dedicada para suscripciones
      this.subRedis = this.redis.duplicate();

      this.subRedis.on('connect', () => {
        logServerEvent('REDIS_SUB_CONNECTED', null, { message: 'Conexión Redis Pub/Sub establecida' });
      });

      this.subRedis.on('error', (error) => {
        logServerEvent('REDIS_SUB_ERROR', null, { error: error.message });
      });

      await this.subRedis.connect();
    } catch (error) {
      this.fallbackToMemory = true;
      logServerEvent('REDIS_INIT_FAILED', null, {
        message: 'Fallo inicialización Redis, usando memoria',
        error: error.message
      });
    }
  }

  /**
   * Obtiene un valor con fallback a memoria
   */
  async get(key) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        logServerEvent('REDIS_GET_ERROR', null, { key, error: error.message });
        return this.memoryCache.get(key) || null;
      }
    }
    return this.memoryCache.get(key) || null;
  }

  /**
   * Establece un valor con TTL y fallback a memoria
   */
  async set(key, value, ttlSeconds = 3600) {
    const serializedValue = JSON.stringify(value);

    if (this.isConnected && !this.fallbackToMemory) {
      try {
        if (ttlSeconds > 0) {
          await this.redis.setex(key, ttlSeconds, serializedValue);
        } else {
          await this.redis.set(key, serializedValue);
        }
      } catch (error) {
        logServerEvent('REDIS_SET_ERROR', null, { key, error: error.message });
        this.memoryCache.set(key, value);
        return;
      }
    }

    // Fallback o backup en memoria
    this.memoryCache.set(key, value);

    // Simular TTL en memoria si está especificado
    if (ttlSeconds > 0) {
      setTimeout(() => {
        if (this.fallbackToMemory) {
          this.memoryCache.delete(key);
        }
      }, ttlSeconds * 1000);
    }
  }

  /**
   * Elimina una clave
   */
  async del(key) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logServerEvent('REDIS_DEL_ERROR', null, { key, error: error.message });
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Obtiene múltiples claves con patrón
   */
  async keys(pattern) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        return await this.redis.keys(pattern);
      } catch (error) {
        logServerEvent('REDIS_KEYS_ERROR', null, { pattern, error: error.message });
      }
    }

    // Fallback: filtrar claves de memoria
    const memoryKeys = Array.from(this.memoryCache.keys());
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return memoryKeys.filter(key => regex.test(key));
  }

  /**
   * Incrementa un contador atómico
   */
  async incr(key, ttlSeconds = 3600) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const result = await this.redis.incr(key);
        if (result === 1 && ttlSeconds > 0) {
          await this.redis.expire(key, ttlSeconds);
        }
        return result;
      } catch (error) {
        logServerEvent('REDIS_INCR_ERROR', null, { key, error: error.message });
      }
    }

    // Fallback en memoria
    const current = this.memoryCache.get(key) || 0;
    const newValue = current + 1;
    this.memoryCache.set(key, newValue);
    return newValue;
  }

  /**
   * Hash operations para datos complejos
   */
  async hget(key, field) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const value = await this.redis.hget(key, field);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        logServerEvent('REDIS_HGET_ERROR', null, { key, field, error: error.message });
      }
    }

    const hash = this.memoryCache.get(key);
    return hash && hash[field] ? hash[field] : null;
  }

  async hset(key, field, value, ttlSeconds = 3600) {
    const serializedValue = JSON.stringify(value);

    if (this.isConnected && !this.fallbackToMemory) {
      try {
        await this.redis.hset(key, field, serializedValue);
        if (ttlSeconds > 0) {
          await this.redis.expire(key, ttlSeconds);
        }
      } catch (error) {
        logServerEvent('REDIS_HSET_ERROR', null, { key, field, error: error.message });
      }
    }

    // Fallback en memoria
    let hash = this.memoryCache.get(key) || {};
    hash[field] = value;
    this.memoryCache.set(key, hash);
  }

  async hgetall(key) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const hash = await this.redis.hgetall(key);
        const result = {};
        for (const [field, value] of Object.entries(hash)) {
          try {
            result[field] = JSON.parse(value);
          } catch {
            result[field] = value;
          }
        }
        return result;
      } catch (error) {
        logServerEvent('REDIS_HGETALL_ERROR', null, { key, error: error.message });
      }
    }

    return this.memoryCache.get(key) || {};
  }

  /**
   * Obtiene estadísticas del manager
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      fallbackToMemory: this.fallbackToMemory,
      memoryKeysCount: this.memoryCache.size,
      redisConfig: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      }
    };
  }

  /**
   * Publica un mensaje en un canal
   */
  async publish(channel, message) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const serializedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
        await this.redis.publish(channel, serializedMessage);
      } catch (error) {
        logServerEvent('REDIS_PUB_ERROR', null, { channel, error: error.message });
      }
    }
  }

  /**
   * Suscribe a un canal
   */
  async subscribe(channel, callback) {
    if (this.isConnected && !this.fallbackToMemory) {
      try {
        await this.subRedis.subscribe(channel);
        this.subRedis.on('message', (ch, message) => {
          if (ch === channel) {
            try {
              const parsedMessage = JSON.parse(message);
              callback(parsedMessage);
            } catch {
              callback(message);
            }
          }
        });
      } catch (error) {
        logServerEvent('REDIS_SUB_ERROR', null, { channel, error: error.message });
      }
    }
  }

  // ===== GESTIÓN GLOBAL DE SALAS =====

  /**
   * Registra una sala en la lista global
   */
  async addRoomToGlobalList(roomId, roomData) {
    const key = 'global:rooms';
    const roomInfo = {
      id: roomId,
      host: roomData.host,
      userCount: roomData.users ? roomData.users.size : 0,
      hasEditor: !!roomData.editor,
      lastActivity: Date.now(),
      createdAt: roomData.createdAt || Date.now(),
      isProtected: roomData.isProtected || false,
      serverInstance: process.env.INSTANCE_ID || 'unknown'
    };

    await this.hset(key, roomId, roomInfo, 86400); // TTL 24 horas
    logServerEvent('ROOM_REGISTERED', null, { roomId, server: roomInfo.serverInstance });
  }

  /**
   * Actualiza información de una sala en la lista global
   */
  async updateRoomInGlobalList(roomId, updates) {
    const key = 'global:rooms';
    const currentRoom = await this.hget(key, roomId);

    if (currentRoom) {
      const updatedRoom = {
        ...currentRoom,
        ...updates,
        lastActivity: Date.now()
      };
      await this.hset(key, roomId, updatedRoom, 86400);
      logServerEvent('ROOM_UPDATED', null, { roomId, updates });
    }
  }

  /**
   * Obtiene todas las salas de todos los servidores
   */
  async getAllGlobalRooms() {
    const key = 'global:rooms';

    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const roomsHash = await this.redis.hgetall(key);
        const rooms = [];

        for (const [roomId, roomDataStr] of Object.entries(roomsHash)) {
          try {
            const roomData = JSON.parse(roomDataStr);
            rooms.push(roomData);
          } catch (error) {
            logServerEvent('PARSE_ROOM_ERROR', null, { roomId, error: error.message });
          }
        }

        // Ordenar por actividad más reciente
        return rooms.sort((a, b) => b.lastActivity - a.lastActivity);
      } catch (error) {
        logServerEvent('GET_GLOBAL_ROOMS_ERROR', null, { error: error.message });
      }
    }

    // Fallback: devolver salas locales de memoria
    const hash = this.memoryCache.get(key) || {};
    return Object.values(hash).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Elimina una sala de la lista global
   */
  async removeRoomFromGlobalList(roomId) {
    const key = 'global:rooms';

    if (this.isConnected && !this.fallbackToMemory) {
      try {
        await this.redis.hdel(key, roomId);
        logServerEvent('ROOM_UNREGISTERED', null, { roomId });
      } catch (error) {
        logServerEvent('REMOVE_ROOM_ERROR', null, { roomId, error: error.message });
      }
    } else {
      // Fallback en memoria
      const hash = this.memoryCache.get(key) || {};
      delete hash[roomId];
      this.memoryCache.set(key, hash);
    }
  }

  /**
   * Limpia salas inactivas de la lista global (más de 1 hora sin actividad)
   */
  async cleanupInactiveGlobalRooms() {
    const key = 'global:rooms';
    const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hora
    let cleanedCount = 0;

    if (this.isConnected && !this.fallbackToMemory) {
      try {
        const roomsHash = await this.redis.hgetall(key);

        for (const [roomId, roomDataStr] of Object.entries(roomsHash)) {
          try {
            const roomData = JSON.parse(roomDataStr);
            if (roomData.lastActivity < cutoffTime) {
              await this.redis.hdel(key, roomId);
              cleanedCount++;
            }
          } catch (error) {
            // Si hay error parseando, eliminar la entrada corrupta
            await this.redis.hdel(key, roomId);
            cleanedCount++;
          }
        }
      } catch (error) {
        logServerEvent('CLEANUP_GLOBAL_ROOMS_ERROR', null, { error: error.message });
      }
    } else {
      // Fallback en memoria
      const hash = this.memoryCache.get(key) || {};
      for (const [roomId, roomData] of Object.entries(hash)) {
        if (roomData.lastActivity < cutoffTime) {
          delete hash[roomId];
          cleanedCount++;
        }
      }
      this.memoryCache.set(key, hash);
    }

    if (cleanedCount > 0) {
      logServerEvent('GLOBAL_ROOMS_CLEANUP', null, { cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Cierre limpio
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    this.memoryCache.clear();
    logServerEvent('REDIS_SHUTDOWN', null, {
      message: 'RedisManager cerrado correctamente'
    });
  }
}

export default RedisManager;