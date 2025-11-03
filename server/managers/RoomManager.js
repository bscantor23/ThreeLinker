/**
 * Gestor de Salas - Maneja la creación, eliminación y gestión de salas de colaboración
 */
class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /**
   * Crea una nueva sala con la información proporcionada
   * @param {string} roomId - ID único de la sala
   * @param {string} hostId - ID del usuario anfitrión
   * @param {string} hostName - Nombre del anfitrión
   * @param {string|null} password - Contraseña de la sala (opcional)
   * @returns {Object} Datos de la sala creada
   */
  createRoom(roomId, hostId, hostName, password = null) {
    if (this.rooms.has(roomId)) {
      throw new Error(`La sala "${roomId}" ya existe`);
    }

    const roomData = {
      id: roomId,
      scene: null,
      users: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      host: hostId,
      password: password || null,
      isProtected: !!password,
    };

    // Agregar al anfitrión como primer usuario
    roomData.users.set(hostId, {
      id: hostId,
      name: hostName || "Anónimo",
      joinedAt: Date.now(),
      role: "host",
    });

    this.rooms.set(roomId, roomData);
    this.updateRoomActivity(roomId);

    return roomData;
  }

  /**
   * Verifica si una sala existe
   * @param {string} roomId - ID de la sala
   * @returns {boolean}
   */
  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  /**
   * Obtiene los datos de una sala
   * @param {string} roomId - ID de la sala
   * @returns {Object|null} Datos de la sala o null si no existe
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Verifica la contraseña de una sala protegida
   * @param {string} roomId - ID de la sala
   * @param {string} password - Contraseña a verificar
   * @returns {boolean}
   */
  verifyRoomPassword(roomId, password) {
    const room = this.getRoom(roomId);
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
  addUserToRoom(roomId, userId, userName) {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error(`La sala "${roomId}" no existe`);
    }

    const userData = {
      id: userId,
      name: userName || "Anónimo",
      joinedAt: Date.now(),
      role: "guest",
    };

    room.users.set(userId, userData);
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
    const room = this.getRoom(roomId);
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
  deleteRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    this.rooms.delete(roomId);
    return room;
  }

  /**
   * Verifica si un usuario es anfitrión de una sala
   * @param {string} roomId - ID de la sala
   * @param {string} userId - ID del usuario
   * @returns {boolean}
   */
  isHost(roomId, userId) {
    const room = this.getRoom(roomId);
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
    const room = this.getRoom(roomId);
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
    const room = this.getRoom(roomId);
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
    const room = this.getRoom(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  /**
   * Obtiene la lista de todas las salas activas
   * @returns {Array} Lista de salas ordenadas por actividad
   */
  getActiveRooms() {
    const activeRooms = Array.from(this.rooms.entries()).map(
      ([roomId, data]) => ({
        id: roomId,
        userCount: data.users.size,
        hasEditor: !!data.editor,
        lastActivity: data.lastActivity || Date.now(),
        createdAt: data.createdAt || Date.now(),
        isProtected: data.isProtected || false,
        host: data.host,
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
    const room = this.getRoom(roomId);
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
