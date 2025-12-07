/**
 * Manejadores de eventos relacionados con salas
 */
import {
  validateRoomCreationData,
  validateJoinRoomData,
  sanitizeUserName,
  formatError,
  logServerEvent,
  broadcastRoomsList,
  broadcastRoomUsers,
} from "../utils/serverUtils.js";

/**
 * Configura todos los manejadores de eventos relacionados con salas
 * @param {Object} socket - Socket del cliente
 * @param {Object} io - Instancia de Socket.IO
 * @param {RoomManager} roomManager - Gestor de salas
 * @param {UserManager} userManager - Gestor de usuarios
 * @param {EditorManager} editorManager - Gestor de editores
 */
export function setupRoomHandlers(
  socket,
  io,
  roomManager,
  userManager,
  editorManager
) {
  // Crear sala con contraseña (solo para anfitriones)
  socket.on("create-room", async (data) => {
    logServerEvent("CREATE_ROOM_REQUEST", socket.id, { roomId: data.roomId });

    const validation = validateRoomCreationData(data);
    if (!validation.isValid) {
      socket.emit(
        "room-creation-failed",
        formatError(validation.errors.join(", "), "VALIDATION_ERROR", {
          roomId: data.roomId,
          errors: validation.errors,
        })
      );
      return;
    }

    const { roomId, userName, password, editor } = data;
    const sanitizedUserName = sanitizeUserName(userName);

    try {
      // Verificar si la sala ya existe
      if (await roomManager.roomExists(roomId)) {
        socket.emit(
          "room-creation-failed",
          formatError("La sala ya existe", "ROOM_EXISTS", { roomId })
        );
        return;
      }

      // Crear nueva sala
      roomManager.createRoom(roomId, socket.id, sanitizedUserName, password);
      editorManager.setRoomEditor(roomId, editor, socket.id);

      // Unir al socket a la sala
      socket.join(roomId);

      // Actualizar información del usuario
      userManager.updateUserRoom(socket.id, roomId, "host");

      // Confirmar creación exitosa
      socket.emit("room-created", {
        roomId: roomId,
        isHost: true,
        userCount: 1,
        hasEditor: true,
      });

      // Enviar lista de usuarios y contador
      const users = roomManager.getRoomUsers(roomId);
      socket.emit("users-list", users);
      socket.emit("user-count", users.length);

      // Actualizar lista de salas para todos los clientes
      setTimeout(async () => await broadcastRoomsList(io, roomManager), 100);

      logServerEvent("ROOM_CREATED", socket.id, {
        roomId,
        isProtected: !!password,
        hostName: sanitizedUserName,
      });
    } catch (error) {
      logServerEvent("ROOM_CREATION_ERROR", socket.id, {
        roomId,
        error: error.message,
      });
      socket.emit(
        "room-creation-failed",
        formatError(error.message, "CREATION_ERROR", { roomId })
      );
    }
  });

  // Unirse a una sala específica
  socket.on("join-room", async (data) => {
    const roomId = typeof data === "string" ? data : data.roomId;
    const userName = typeof data === "object" ? data.userName : "Anónimo";
    const password = typeof data === "object" ? data.password : null;

    logServerEvent("JOIN_ROOM_REQUEST", socket.id, { roomId, userName });

    const validation = validateJoinRoomData({ roomId, userName });
    if (!validation.isValid) {
      socket.emit(
        "join-room-failed",
        formatError(validation.errors.join(", "), "VALIDATION_ERROR", {
          roomId,
          errors: validation.errors,
        })
      );
      return;
    }

    const sanitizedUserName = sanitizeUserName(userName);

    try {
      // Verificar si la sala existe
      if (!await roomManager.roomExists(roomId)) {
        socket.emit(
          "join-room-failed",
          formatError("La sala no existe", "ROOM_NOT_FOUND", { roomId })
        );
        return;
      }

      // Verificar contraseña si la sala está protegida
      if (!roomManager.verifyRoomPassword(roomId, password)) {
        socket.emit(
          "join-room-failed",
          formatError("Contraseña incorrecta", "INVALID_PASSWORD", { roomId })
        );
        return;
      }

      // Unir al socket a la sala
      socket.join(roomId);

      // Agregar usuario a la sala
      roomManager.addUserToRoom(roomId, socket.id, sanitizedUserName);

      // Actualizar información del usuario
      userManager.updateUserRoom(socket.id, roomId, "guest");

      const room = roomManager.getRoomSync(roomId);
      const hasEditor = editorManager.hasRoomEditor(roomId);

      // Confirmar que el usuario se unió exitosamente PRIMERO
      socket.emit("joined-room", {
        roomId: roomId,
        userCount: room.users.size,
        hasEditor: hasEditor,
        isHost: roomManager.isHost(roomId, socket.id),
      });

      // Notificar a otros usuarios sobre el nuevo usuario
      socket.to(roomId).emit("user-joined", {
        userId: socket.id,
        userName: sanitizedUserName,
        userCount: room.users.size,
      });

      // Enviar lista actualizada de usuarios
      broadcastRoomUsers(io, roomId, roomManager);

      // Si la sala tiene un editor guardado, enviarlo al nuevo usuario
      if (hasEditor) {
        const roomEditor = editorManager.getRoomEditor(roomId);
        if (roomEditor && roomEditor.editorData) {
          // Enviar el editor existente solo al usuario que se unió
          socket.emit("receive-full-editor", {
            editorData: roomEditor.editorData,
            version: roomEditor.version,
            hostId: roomEditor.hostId,
            lastUpdate: roomEditor.lastUpdate,
            originUserId: roomEditor.hostId,
            isInitialSync: true, // Marcar como sincronización inicial
          });
        }
      }

      logServerEvent("USER_JOINED_ROOM", socket.id, {
        roomId,
        userName: sanitizedUserName,
        userCount: room.users.size,
        sentExistingEditor: hasEditor,
      });
    } catch (error) {
      logServerEvent("JOIN_ROOM_ERROR", socket.id, {
        roomId,
        error: error.message,
      });
      socket.emit(
        "join-room-failed",
        formatError(error.message, "JOIN_ERROR", { roomId })
      );
    }
  });

  // Usuario sale de una sala voluntariamente
  socket.on("leave-room", async (roomId) => {
    logServerEvent("LEAVE_ROOM_REQUEST", socket.id, { roomId });

    try {
      const userData = roomManager.removeUserFromRoom(roomId, socket.id);

      if (userData) {
        // Salir de la sala de Socket.IO
        socket.leave(roomId);

        // Notificar a otros usuarios sobre la salida
        socket.to(roomId).emit("user-left", {
          userId: socket.id,
          userName: userData.name,
          userCount: roomManager.getRoomSync(roomId)?.users.size || 0,
        });

        // Actualizar información del usuario
        userManager.updateUserRoom(socket.id, null, null);

        // Confirmar al usuario que salió
        socket.emit("left-room", { roomId, success: true });

        // Actualizar lista de salas si la sala fue eliminada
        if (!await roomManager.roomExists(roomId)) {
          setTimeout(async () => await broadcastRoomsList(io, roomManager), 100);
        }

        logServerEvent("USER_LEFT_ROOM", socket.id, {
          roomId,
          userName: userData.name,
        });
      }
    } catch (error) {
      logServerEvent("LEAVE_ROOM_ERROR", socket.id, {
        roomId,
        error: error.message,
      });
      socket.emit("left-room", {
        roomId,
        success: false,
        error: error.message,
      });
    }
  });

  // Eliminar sala (solo anfitrión)
  socket.on("delete-room", async (data) => {
    const { roomId } = data;
    logServerEvent("DELETE_ROOM_REQUEST", socket.id, { roomId });

    try {
      if (!await roomManager.roomExists(roomId)) {
        socket.emit(
          "delete-room-failed",
          formatError("La sala no existe", "ROOM_NOT_FOUND", { roomId })
        );
        return;
      }

      // Verificar que el usuario sea el anfitrión
      if (!roomManager.isHost(roomId, socket.id)) {
        socket.emit(
          "delete-room-failed",
          formatError("Solo el anfitrión puede eliminar la sala", "NOT_HOST", {
            roomId,
          })
        );
        return;
      }

      const room = roomManager.getRoomSync(roomId);
      const hostName = room.users.get(socket.id)?.name || "Anfitrión";

      // Notificar a TODOS los usuarios de la sala
      io.to(roomId).emit("room-deleted", {
        roomId: roomId,
        message: `El anfitrión eliminó la sala "${roomId}"`,
        deletedByHost: true,
        hostName: hostName,
      });

      // Desconectar a todos los usuarios y limpiar su estado
      for (const [userId] of room.users) {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          userSocket.leave(roomId);
        }
        userManager.updateUserRoom(userId, null, null);
      }

      // Eliminar la sala
      roomManager.deleteRoom(roomId);

      // Actualizar lista de salas inmediatamente y después de un delay
      await broadcastRoomsList(io, roomManager);
      setTimeout(async () => await broadcastRoomsList(io, roomManager), 1000);

      logServerEvent("ROOM_DELETED", socket.id, {
        roomId,
        hostName,
        userCount: room.users.size,
      });
    } catch (error) {
      logServerEvent("DELETE_ROOM_ERROR", socket.id, {
        roomId,
        error: error.message,
      });
      socket.emit(
        "delete-room-failed",
        formatError(error.message, "DELETE_ERROR", { roomId })
      );
    }
  });

  // Obtener lista de salas activas
  socket.on("get-rooms", async () => {
    logServerEvent("GET_ROOMS_REQUEST", socket.id);
    await broadcastRoomsList(io, roomManager);
  });
}
