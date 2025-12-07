/**
 * Gestor de Salas - Maneja la creación, eliminación y gestión de salas de colaboración
 * Ahora con soporte Redis para alta disponibilidad
 */
import RedisManager from './RedisManager.js';
import { REDIS_CONFIG } from '../config/serverConfig.js';
import { logServerEvent } from '../utils/serverUtils.js';

class RoomManager {
  constructor(redisManager = null) {
    this.rooms = new Map(); // Cache local
    this.redis = redisManager || new RedisManager();
    this.keyPrefix = REDIS_CONFIG.KEYS.ROOM;
    this.userRoomPrefix = REDIS_CONFIG.KEYS.USER_ROOM;
    this.roomUsersPrefix = REDIS_CONFIG.KEYS.ROOM_USERS;
  }

  /**
   * Crea una nueva sala con la información proporcionada
   * @param {string} roomId - ID único de la sala
   * @param {string} hostId - ID del usuario anfitrión
   * @param {string} hostName - Nombre del anfitrión
   * @param {string|null} password - Contraseña de la sala (opcional)
   * @returns {Object} Datos de la sala creada
   */
  async createRoom(roomId, hostId, hostName, password = null) {
    // Verificar si la sala ya existe en Redis
    const existingRoom = await this.redis.get(`${this.keyPrefix}${roomId}`);
    if (existingRoom) {
      throw new Error(`La sala "${roomId}" ya existe`);
    }

    const roomData = {
      id: roomId,
      scene: null,
      users: {}, // Convertimos Map a Object para serialización JSON
      createdAt: Date.now(),
      lastActivity: Date.now(),
      host: hostId,
      password: password || null,
      isProtected: !!password,
    };

    // Agregar al anfitrión como primer usuario
    const hostUser = {
      id: hostId,
      name: hostName || "Anónimo",
      joinedAt: Date.now(),
      role: "host",
    };

    roomData.users[hostId] = hostUser;

    // Guardar en Redis con TTL
    await this.redis.set(
      `${this.keyPrefix}${roomId}`, 
      roomData, 
      REDIS_CONFIG.TTL.ROOM
    );

    // Registrar en la lista global de salas
    const localRoomData = {
      ...roomData,
      users: new Map([[hostId, hostUser]])
    };
    await this.redis.addRoomToGlobalList(roomId, localRoomData);

    // Mantener en cache local para performance
    this.rooms.set(roomId, localRoomData);

    // Establecer relación user -> room
    await this.redis.set(
      `${this.userRoomPrefix}${hostId}`, 
      roomId, 
      REDIS_CONFIG.TTL.USER
    );

    this.updateRoomActivity(roomId);

    logServerEvent('ROOM_CREATED', roomId, {
      hostId,
      hostName,
      isProtected: !!password
    });

    return localRoomData;
  }

  /**
   * Obtiene roomId desde un socket para sticky routing
   * @param {Object} socket - Socket del usuario
   * @returns {string|null} roomId si está en una sala
   */
  async getRoomIdFromSocket(socket) {
    // Primero buscar en cache local
    for (const [roomId, room] of this.rooms) {
      if (room.users.has(socket.id)) {
        return roomId;
      }
    }

    // Buscar en Redis si no está en cache
    const roomId = await this.redis.get(`${this.userRoomPrefix}${socket.id}`);
    return roomId;
  }

  /**
   * Verifica si una sala existe
   * @param {string} roomId - ID de la sala
   * @returns {boolean}
   */
  async roomExists(roomId) {
    // Verificar cache local primero
    if (this.rooms.has(roomId)) {
      return true;
    }

    // Verificar en Redis
    const roomData = await this.redis.get(`${this.keyPrefix}${roomId}`);
    return !!roomData;
  }

  /**
   * Obtiene los datos de una sala (solo cache local)
   * @param {string} roomId - ID de la sala
   * @returns {Object|null} Datos de la sala o null si no existe en cache local
   */
  getRoomSync(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Obtiene los datos de una sala (con carga desde Redis si es necesario)
   * @param {string} roomId - ID de la sala
   * @returns {Object|null} Datos de la sala o null si no existe
   */
  async getRoom(roomId) {
    // Verificar cache local primero
    let room = this.rooms.get(roomId);
    
    if (!room) {
      // Cargar desde Redis si no está en cache
      const redisData = await this.redis.get(`${this.keyPrefix}${roomId}`);
      if (redisData) {
        // Reconstruir Map de usuarios para compatibilidad local
        room = {
          ...redisData,
          users: new Map(Object.entries(redisData.users || {}))
        };
        
        // Agregar a cache local
        this.rooms.set(roomId, room);
      }
    }
    
    return room || null;
  }

  /**
   * Verifica la contraseña de una sala protegida
   * @param {string} roomId - ID de la sala
   * @param {string} password - Contraseña a verificar
   * @returns {boolean}
   */
  async verifyRoomPassword(roomId, password) {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    if (!room.isProtected) return true;
    return room.password === password;
  }

  /**
   * Agrega un usuario a una sala
   * @param {string} roomId - ID de la sala
   * @param {string} userId - ID del usuario
   * @param {string} userName - Nombre del usuario
   * @returns {Object} Datos del usuario agregado
   */
  async addUserToRoom(roomId, userId, userName) {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error(`La sala "${roomId}" no existe`);
    }

    const userData = {
      id: userId,
      name: userName || "Anónimo",
      joinedAt: Date.now(),
      role: "guest",
    };

    // Actualizar tanto local como Redis
    room.users.set(userId, userData);

    // Sincronizar con Redis - convertir Map a Object para serialización
    const roomDataForRedis = {
      ...room,
      users: Object.fromEntries(room.users)
    };
    
    await this.redis.set(
      `${this.keyPrefix}${roomId}`, 
      roomDataForRedis, 
      REDIS_CONFIG.TTL.ROOM
    );

    // Actualizar contador de usuarios en la lista global
    await this.redis.updateRoomInGlobalList(roomId, { 
      userCount: room.users.size 
    });

    // Establecer relación user -> room
    await this.redis.set(
      `${this.userRoomPrefix}${userId}`, 
      roomId, 
      REDIS_CONFIG.TTL.USER
    );
    this.updateRoomActivity(roomId);

    return userData;
  }

  /**
   * Remueve un usuario de una sala
   * @param {string} roomId - ID de la sala
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Datos del usuario removido
   */
  removeUserFromRoom(roomId, userId) {
    const room = this.getRoomSync(roomId);
    if (!room) return null;

    const userData = room.users.get(userId);
    room.users.delete(userId);
    this.updateRoomActivity(roomId);

    // Si la sala queda vacía, eliminarla
    if (room.users.size === 0) {
      this.deleteRoom(roomId);
    }

    return userData;
  }

  /**
   * Elimina una sala completa
   * @param {string} roomId - ID de la sala
   * @returns {Object|null} Datos de la sala eliminada
   */
  async deleteRoom(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    // Eliminar de Redis
    await this.redis.del(`${this.keyPrefix}${roomId}`);
    
    // Eliminar de la lista global
    await this.redis.removeRoomFromGlobalList(roomId);

    // Eliminar del cache local
    this.rooms.delete(roomId);
    
    logServerEvent('ROOM_DELETED_FROM_GLOBAL', roomId, {
      serverInstance: process.env.INSTANCE_ID || 'unknown'
    });
    
    return room;
  }

  /**
   * Verifica si un usuario es anfitrión de una sala
   * @param {string} roomId - ID de la sala
   * @param {string} userId - ID del usuario
   * @returns {boolean}
   */
  isHost(roomId, userId) {
    const room = this.getRoomSync(roomId);
    return room ? room.host === userId : false;
  }

  /**
   * Actualiza el nombre de un usuario en una sala
   * @param {string} roomId - ID de la sala
   * @param {string} userId - ID del usuario
   * @param {string} newName - Nuevo nombre
   * @returns {Object|null} Datos actualizados del usuario
   */
  updateUserName(roomId, userId, newName) {
    const room = this.getRoomSync(roomId);
    if (!room) return null;

    const user = room.users.get(userId);
    if (!user) return null;

    const oldName = user.name;
    user.name = newName;
    this.updateRoomActivity(roomId);

    return { ...user, oldName };
  }

  /**
   * Actualiza la escena de una sala
   * @param {string} roomId - ID de la sala
   * @param {Object} sceneData - Datos de la escena
   */
  updateRoomScene(roomId, sceneData) {
    const room = this.getRoomSync(roomId);
    if (room) {
      room.scene = sceneData;
      this.updateRoomActivity(roomId);
    }
  }

  /**
   * Actualiza la actividad de una sala
   * @param {string} roomId - ID de la sala
   */
  updateRoomActivity(roomId) {
    const room = this.getRoomSync(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  /**
   * Obtiene la lista de todas las salas activas (de TODOS los servidores)
   * @returns {Array} Lista de salas ordenadas por actividad
   */
  async getActiveRooms() {
    try {
      // Intentar obtener de Redis primero (incluye todas las instancias)
      const globalRooms = await this.redis.getAllGlobalRooms();
      
      if (globalRooms && globalRooms.length > 0) {
        return globalRooms;
      }
    } catch (error) {
      logServerEvent('GET_GLOBAL_ROOMS_ERROR', null, { 
        error: error.message,
        fallbackToLocal: true 
      });
    }
    
    // Fallback: devolver solo salas locales si Redis falla
    const activeRooms = Array.from(this.rooms.entries()).map(
      ([roomId, data]) => ({
        id: roomId,
        userCount: data.users.size,
        hasEditor: !!data.editor,
        lastActivity: data.lastActivity || Date.now(),
        createdAt: data.createdAt || Date.now(),
        isProtected: data.isProtected || false,
        host: data.host,
        serverInstance: process.env.INSTANCE_ID || 'local'
      })
    );

    // Ordenar por actividad más reciente
    return activeRooms.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Obtiene la lista de usuarios de una sala
   * @param {string} roomId - ID de la sala
   * @returns {Array} Lista de usuarios en la sala
   */
  getRoomUsers(roomId) {
    const room = this.getRoomSync(roomId);
    return room ? Array.from(room.users.values()) : [];
  }

  /**
   * Obtiene estadísticas del gestor de salas
   * @returns {Object} Estadísticas
   */
  getStats() {
    const totalRooms = this.rooms.size;
    const totalUsers = Array.from(this.rooms.values()).reduce(
      (sum, room) => sum + room.users.size,
      0
    );
    const protectedRooms = Array.from(this.rooms.values()).filter(
      (room) => room.isProtected
    ).length;

    return {
      totalRooms,
      totalUsers,
      protectedRooms,
      publicRooms: totalRooms - protectedRooms,
    };
  }
}

export default RoomManager;
