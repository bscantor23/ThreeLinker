/**
 * Gestor de Usuarios - Maneja la información y estado de usuarios conectados
 */
class UserManager {
  constructor() {
    this.users = new Map();
  }

  /**
   * Registra un nuevo usuario conectado
   * @param {string} userId - ID único del usuario (socket.id)
   * @param {string} name - Nombre del usuario
   * @returns {Object} Datos del usuario registrado
   */
  registerUser(userId, name = "Anónimo") {
    const userData = {
      id: userId,
      name: name,
      currentRoom: null,
      role: null,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.users.set(userId, userData);
    return userData;
  }

  /**
   * Verifica si un usuario existe
   * @param {string} userId - ID del usuario
   * @returns {boolean}
   */
  userExists(userId) {
    return this.users.has(userId);
  }

  /**
   * Obtiene los datos de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Datos del usuario o null si no existe
   */
  getUser(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Actualiza el nombre de un usuario
   * @param {string} userId - ID del usuario
   * @param {string} newName - Nuevo nombre
   * @returns {Object|null} Datos actualizados del usuario
   */
  updateUserName(userId, newName) {
    const user = this.getUser(userId);
    if (!user) return null;

    const oldName = user.name;
    user.name = newName;
    user.lastActivity = Date.now();

    return { ...user, oldName };
  }

  /**
   * Actualiza la sala actual del usuario
   * @param {string} userId - ID del usuario
   * @param {string|null} roomId - ID de la sala (null si no está en ninguna)
   * @param {string} role - Rol del usuario en la sala ('host' o 'guest')
   * @returns {Object|null} Datos actualizados del usuario
   */
  updateUserRoom(userId, roomId, role = null) {
    const user = this.getUser(userId);
    if (!user) return null;

    user.currentRoom = roomId;
    user.role = role;
    user.lastActivity = Date.now();

    return user;
  }

  /**
   * Actualiza la actividad de un usuario
   * @param {string} userId - ID del usuario
   */
  updateUserActivity(userId) {
    const user = this.getUser(userId);
    if (user) {
      user.lastActivity = Date.now();
    }
  }

  /**
   * Remueve un usuario del sistema
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Datos del usuario removido
   */
  removeUser(userId) {
    const userData = this.getUser(userId);
    this.users.delete(userId);
    return userData;
  }

  /**
   * Obtiene todos los usuarios conectados
   * @returns {Array} Lista de todos los usuarios
   */
  getAllUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Obtiene usuarios por sala
   * @param {string} roomId - ID de la sala
   * @returns {Array} Lista de usuarios en la sala específica
   */
  getUsersByRoom(roomId) {
    return this.getAllUsers().filter((user) => user.currentRoom === roomId);
  }

  /**
   * Obtiene usuarios sin sala asignada
   * @returns {Array} Lista de usuarios sin sala
   */
  getUsersWithoutRoom() {
    return this.getAllUsers().filter((user) => !user.currentRoom);
  }

  /**
   * Busca usuarios por nombre (búsqueda parcial, case-insensitive)
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Array} Lista de usuarios que coinciden
   */
  searchUsersByName(searchTerm) {
    const term = searchTerm.toLowerCase();
    return this.getAllUsers().filter((user) =>
      user.name.toLowerCase().includes(term)
    );
  }

  /**
   * Obtiene anfitriones activos
   * @returns {Array} Lista de usuarios que son anfitriones
   */
  getActiveHosts() {
    return this.getAllUsers().filter((user) => user.role === "host");
  }

  /**
   * Obtiene estadísticas de usuarios
   * @returns {Object} Estadísticas
   */
  getStats() {
    const totalUsers = this.users.size;
    const usersInRooms = this.getAllUsers().filter(
      (user) => user.currentRoom
    ).length;
    const hosts = this.getActiveHosts().length;
    const guests = this.getAllUsers().filter(
      (user) => user.role === "guest"
    ).length;

    return {
      totalUsers,
      usersInRooms,
      usersWithoutRoom: totalUsers - usersInRooms,
      hosts,
      guests,
    };
  }

  /**
   * Limpia usuarios inactivos (opcional, para mantenimiento)
   * @param {number} inactiveThreshold - Tiempo en ms para considerar inactivo
   * @returns {Array} Lista de usuarios removidos por inactividad
   */
  cleanupInactiveUsers(inactiveThreshold = 30 * 60 * 1000) {
    // 30 minutos por defecto
    const now = Date.now();
    const inactiveUsers = [];

    for (const [userId, user] of this.users.entries()) {
      if (now - user.lastActivity > inactiveThreshold) {
        inactiveUsers.push(user);
        this.users.delete(userId);
      }
    }

    return inactiveUsers;
  }

  /**
   * Obtiene información resumida de un usuario para logs
   * @param {string} userId - ID del usuario
   * @returns {string} Información resumida
   */
  getUserSummary(userId) {
    const user = this.getUser(userId);
    if (!user) return `Usuario ${userId} (no encontrado)`;

    const roomInfo = user.currentRoom
      ? ` en sala "${user.currentRoom}"`
      : " sin sala";
    const roleInfo = user.role ? ` como ${user.role}` : "";

    return `${user.name} (${userId.substring(0, 8)})${roomInfo}${roleInfo}`;
  }
}

export default UserManager;
