/**
 * Utilidades del Servidor - Funciones helper para la gestión del servidor
 */

/**
 * Emite la lista actualizada de salas a todos los clientes conectados
 * @param {Object} io - Instancia de Socket.IO
 * @param {RoomManager} roomManager - Gestor de salas
 */
export function broadcastRoomsList(io, roomManager) {
  const activeRooms = roomManager.getActiveRooms();
  io.emit("rooms-list", activeRooms);
}

/**
 * Emite la lista de usuarios de una sala específica
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID de la sala
 * @param {RoomManager} roomManager - Gestor de salas
 */
export function broadcastRoomUsers(io, roomId, roomManager) {
  const users = roomManager.getRoomUsers(roomId);
  io.to(roomId).emit("users-list", users);
  io.to(roomId).emit("user-count", users.length);
}

/**
 * Valida los datos de creación de sala
 * @param {Object} data - Datos de la sala
 * @returns {Object} Resultado de validación
 */
export function validateRoomCreationData(data) {
  const errors = [];

  if (!data.roomId || typeof data.roomId !== "string") {
    errors.push("ID de sala es requerido y debe ser una cadena");
  }

  if (data.roomId && data.roomId.length < 3) {
    errors.push("ID de sala debe tener al menos 3 caracteres");
  }

  if (data.roomId && data.roomId.length > 50) {
    errors.push("ID de sala no puede tener más de 50 caracteres");
  }

  if (data.roomId && !/^[a-zA-Z0-9_-]+$/.test(data.roomId)) {
    errors.push(
      "ID de sala solo puede contener letras, números, guiones y guiones bajos"
    );
  }

  if (data.password && data.password.length < 4) {
    errors.push("La contraseña debe tener al menos 4 caracteres");
  }

  if (data.userName && data.userName.length > 30) {
    errors.push("El nombre de usuario no puede tener más de 30 caracteres");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida los datos para unirse a una sala
 * @param {Object} data - Datos para unirse
 * @returns {Object} Resultado de validación
 */
export function validateJoinRoomData(data) {
  const errors = [];

  if (!data.roomId || typeof data.roomId !== "string") {
    errors.push("ID de sala es requerido");
  }

  if (data.userName && data.userName.length > 30) {
    errors.push("El nombre de usuario no puede tener más de 30 caracteres");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Limpia y sanitiza el nombre de usuario
 * @param {string} userName - Nombre del usuario
 * @returns {string} Nombre sanitizado
 */
export function sanitizeUserName(userName) {
  if (!userName || typeof userName !== "string") {
    return "Anónimo";
  }

  // Remover caracteres especiales y limitar longitud
  return (
    userName
      .trim()
      .replace(/[<>\"'&]/g, "") // Remover caracteres peligrosos
      .substring(0, 30) || "Anónimo"
  );
}

/**
 * Genera un ID único para sala
 * @returns {string} ID único
 */
export function generateRoomId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `sala-${timestamp}-${randomStr}`;
}

/**
 * Formatea información de error para envío al cliente
 * @param {string} message - Mensaje de error
 * @param {string} code - Código de error opcional
 * @param {Object} details - Detalles adicionales
 * @returns {Object} Error formateado
 */
export function formatError(message, code = "UNKNOWN_ERROR", details = {}) {
  return {
    error: message,
    code,
    timestamp: Date.now(),
    ...details,
  };
}

/**
 * Registra eventos del servidor con formato consistente
 * @param {string} event - Tipo de evento
 * @param {string} userId - ID del usuario
 * @param {Object} details - Detalles del evento
 */
export function logServerEvent(event, userId, details = {}) {
  const timestamp = new Date().toISOString();
  const userInfo = userId ? ` [${userId.substring(0, 8)}]` : "";

  console.log(`[${timestamp}] ${event}${userInfo}:`, details);
}

/**
 * Verifica la salud del servidor
 * @param {RoomManager} roomManager - Gestor de salas
 * @param {UserManager} userManager - Gestor de usuarios
 * @returns {Object} Estado de salud
 */
export function getServerHealth(roomManager, userManager) {
  const roomStats = roomManager.getStats();
  const userStats = userManager.getStats();

  return {
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    rooms: roomStats,
    users: userStats,
  };
}

/**
 * Limpia recursos del servidor (salas vacías, usuarios desconectados, etc.)
 * @param {RoomManager} roomManager - Gestor de salas
 * @param {UserManager} userManager - Gestor de usuarios
 * @param {Object} io - Instancia de Socket.IO
 * @returns {Object} Reporte de limpieza
 */
export function cleanupServerResources(roomManager, userManager, io) {
  const report = {
    cleanedRooms: 0,
    cleanedUsers: 0,
    timestamp: Date.now(),
  };

  // Limpiar usuarios inactivos
  const inactiveUsers = userManager.cleanupInactiveUsers();
  report.cleanedUsers = inactiveUsers.length;

  // Log de limpieza si hubo actividad
  if (report.cleanedRooms > 0 || report.cleanedUsers > 0) {
    logServerEvent("CLEANUP", null, report);
  }

  return report;
}

/**
 * Convierte datos de sala para envío al cliente (remover información sensible)
 * @param {Object} roomData - Datos internos de la sala
 * @returns {Object} Datos públicos de la sala
 */
export function sanitizeRoomDataForClient(roomData) {
  return {
    id: roomData.id,
    userCount: roomData.users.size,
    hasEditor: !!roomData.editor,
    lastActivity: roomData.lastActivity,
    createdAt: roomData.createdAt,
    isProtected: roomData.isProtected,
    host: roomData.host,
    // NO incluir: password, editor data completa, etc.
  };
}

/**
 * Convierte datos de usuario para envío al cliente
 * @param {Object} userData - Datos internos del usuario
 * @returns {Object} Datos públicos del usuario
 */
export function sanitizeUserDataForClient(userData) {
  return {
    id: userData.id,
    name: userData.name,
    role: userData.role,
    joinedAt: userData.joinedAt,
    // NO incluir: información de conexión, actividad detallada, etc.
  };
}
