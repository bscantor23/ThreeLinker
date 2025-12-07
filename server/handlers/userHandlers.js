/**
 * Manejadores de eventos relacionados con usuarios
 */
import {
  sanitizeUserName,
  logServerEvent,
  broadcastRoomUsers,
  broadcastRoomsList,
} from "../utils/serverUtils.js";

/**
 * Configura todos los manejadores de eventos relacionados con usuarios
 * @param {Object} socket - Socket del cliente
 * @param {Object} io - Instancia de Socket.IO
 * @param {RoomManager} roomManager - Gestor de salas
 * @param {UserManager} userManager - Gestor de usuarios
 */
export function setupUserHandlers(socket, io, roomManager, userManager) {
  // Conexión inicial del usuario
  socket.on("connect", () => {
    // Registrar el usuario conectado
    userManager.registerUser(socket.id);

    logServerEvent("USER_CONNECTED", socket.id, {
      userAgent: socket.handshake.headers["user-agent"],
      ip: socket.handshake.address,
    });
  });

  // Cambio de nombre de usuario
  socket.on("user-name-change", (data) => {
    const { roomId, userName } = data;
    const sanitizedUserName = sanitizeUserName(userName);

    logServerEvent("USER_NAME_CHANGE_REQUEST", socket.id, {
      roomId,
      oldName: userManager.getUser(socket.id)?.name,
      newName: sanitizedUserName,
    });

    try {
      // Actualizar nombre en el gestor de usuarios
      const userResult = userManager.updateUserName(
        socket.id,
        sanitizedUserName
      );

      if (!userResult) {
        logServerEvent("USER_NAME_CHANGE_ERROR", socket.id, {
          error: "Usuario no encontrado",
        });
        return;
      }

      // Si el usuario está en una sala, actualizar también ahí
      if (roomId && roomManager.roomExists(roomId)) {
        const roomResult = roomManager.updateUserName(
          roomId,
          socket.id,
          sanitizedUserName
        );

        if (roomResult) {
          // Notificar a otros usuarios sobre el cambio de nombre
          socket.to(roomId).emit("user-name-changed", {
            userId: socket.id,
            userName: sanitizedUserName,
            oldName: roomResult.oldName,
          });

          // Enviar lista actualizada de usuarios a todos en la sala
          broadcastRoomUsers(io, roomId, roomManager);

          logServerEvent("USER_NAME_CHANGED", socket.id, {
            roomId,
            oldName: roomResult.oldName,
            newName: sanitizedUserName,
          });
        }
      }
    } catch (error) {
      logServerEvent("USER_NAME_CHANGE_ERROR", socket.id, {
        roomId,
        userName: sanitizedUserName,
        error: error.message,
      });
    }
  });

  // Manejo de desconexión
  socket.on("disconnect", (reason) => {
    logServerEvent("USER_DISCONNECT", socket.id, { reason });

    try {
      // Obtener información del usuario antes de eliminarlo
      const userInfo = userManager.getUser(socket.id);
      const currentRoom = userInfo?.currentRoom;

      // Si el usuario estaba en una sala, manejarlo
      if (currentRoom && roomManager.roomExists(currentRoom)) {
        const userData = roomManager.removeUserFromRoom(currentRoom, socket.id);

        if (userData) {
          // Notificar a otros usuarios sobre la desconexión
          socket.to(currentRoom).emit("user-left", {
            userId: socket.id,
            userName: userData.name || userInfo?.name || "Anónimo",
            userCount: roomManager.getRoomSync(currentRoom)?.users.size || 0,
          });

          // Si la sala se eliminó porque quedó vacía, actualizar lista de salas
          if (!roomManager.roomExists(currentRoom)) {
            setTimeout(() => broadcastRoomsList(io, roomManager), 500);
          }
        }
      }

      // Eliminar usuario del registro global
      userManager.removeUser(socket.id);

      logServerEvent("USER_DISCONNECTED", socket.id, {
        userName: userInfo?.name,
        wasInRoom: !!currentRoom,
        roomId: currentRoom,
      });
    } catch (error) {
      logServerEvent("USER_DISCONNECT_ERROR", socket.id, {
        error: error.message,
      });
    }
  });

  // Ping/keepalive para mantener conexión activa
  socket.on("ping", () => {
    userManager.updateUserActivity(socket.id);
    socket.emit("pong");
  });

  // Actualizar actividad del usuario
  socket.on("user-activity", () => {
    userManager.updateUserActivity(socket.id);
  });

  // Obtener información del usuario actual
  socket.on("get-user-info", () => {
    const userInfo = userManager.getUser(socket.id);
    socket.emit("user-info", userInfo);
  });

  // Obtener estadísticas del usuario (para debugging/admin)
  socket.on("get-user-stats", () => {
    const stats = userManager.getStats();
    socket.emit("user-stats", stats);
  });
}
