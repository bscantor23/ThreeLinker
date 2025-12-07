/**
 * Configuración principal del servidor de colaboración
 */
import RoomManager from "./managers/RoomManager.js";
import UserManager from "./managers/UserManager.js";
import EditorManager from "./managers/EditorManager.js";
import { setupRoomHandlers } from "./handlers/roomHandlers.js";
import { setupUserHandlers } from "./handlers/userHandlers.js";
import { setupEditorHandlers } from "./handlers/editorHandlers.js";
import {
  logServerEvent,
  getServerHealth,
  cleanupServerResources,
  broadcastRoomsList,
} from "./utils/serverUtils.js";

/**
 * Configura el sistema de colaboración del servidor
 * @param {Object} io - Instancia de Socket.IO
 * @param {RedisManager} redisManager - Instancia opcional de RedisManager
 * @returns {Object} Instancias de los gestores y funciones de utilidad
 */
export function setupCollaborationServer(io, redisManager = null) {
  // Inicializar gestores con Redis support
  const roomManager = new RoomManager(redisManager);
  const userManager = new UserManager(redisManager);
  const editorManager = new EditorManager(redisManager);

  logServerEvent("info", "Collaboration Server starting...", {
    modules: ["RoomManager", "UserManager", "EditorManager", "SocketHandlers"],
  });

  // Configurar eventos de conexión de Socket.IO
  io.on("connection", (socket) => {
    // Registrar usuario conectado
    userManager.registerUser(socket.id);

    logServerEvent("USER_CONNECTED", socket.id, {
      totalUsers: userManager.getStats().totalUsers,
      userAgent: socket.handshake.headers["user-agent"]?.substring(0, 50),
    });

        // Configurar event handlers
    setupUserHandlers(socket, io, roomManager, userManager);
    setupRoomHandlers(socket, io, roomManager, userManager, editorManager);
    setupEditorHandlers(socket, io, roomManager, userManager, editorManager);

    // Enviar lista inicial de salas al cliente recién conectado
    setTimeout(() => {
      broadcastRoomsList(io, roomManager);
    }, 100);
  });

  // Configurar limpieza automática de recursos (cada 5 minutos)
  const cleanupInterval = setInterval(async () => {
    const report = cleanupServerResources(roomManager, userManager, io);
    
    // Limpiar también salas inactivas de la lista global
    if (redisManager) {
      try {
        const cleanedGlobalRooms = await redisManager.cleanupInactiveGlobalRooms();
        report.cleanedGlobalRooms = cleanedGlobalRooms;
      } catch (error) {
        logServerEvent("GLOBAL_CLEANUP_ERROR", null, { error: error.message });
      }
    }
    
    if (report.cleanedUsers > 0 || report.cleanedGlobalRooms > 0) {
      logServerEvent("AUTO_CLEANUP", null, report);
    }
  }, 5 * 60 * 1000); // 5 minutos

  // Configurar broadcasting periódico de lista de salas (cada 30 segundos)
  const broadcastInterval = setInterval(async () => {
    await broadcastRoomsList(io, roomManager);
  }, 30 * 1000); // 30 segundos

  // Función para obtener estadísticas del servidor
  const getStats = () => {
    return {
      health: getServerHealth(roomManager, userManager),
      rooms: roomManager.getStats(),
      users: userManager.getStats(),
      editors: editorManager.getStats(),
      activeRooms: roomManager.getActiveRooms().length,
      timestamp: Date.now(),
    };
  };

    // Función para limpiar recursos manualmente
  const cleanup = () => {
    const cleanedUsers = userManager.cleanupInactiveUsers();
    const cleanedRooms = roomManager.cleanupEmptyRooms();
    const cleanedEditors = editorManager.cleanupOldEditors();
    
    return {
      cleanedUsers,
      cleanedRooms,
      cleanedEditors,
    };
  };

  // Función para cerrar el servidor limpiamente
  const shutdown = () => {
    logServerEvent("SERVER_SHUTDOWN", null, {
      message: "Cerrando servidor de colaboración",
      finalStats: getStats(),
    });

    // Limpiar intervalos
    clearInterval(cleanupInterval);
    clearInterval(broadcastInterval);

    // Notificar a todos los clientes sobre el cierre
    io.emit("server-shutdown", {
      message:
        "El servidor se está reiniciando. Reconectando automáticamente...",
      timestamp: Date.now(),
    });

    // Desconectar todos los sockets
    io.disconnectSockets(true);
  };

  // Manejar señales del sistema para cierre limpio
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logServerEvent("SERVER_READY", null, {
    message: "Servidor de colaboración iniciado correctamente",
    initialStats: getStats(),
  });

  // Retornar instancias y utilidades para uso externo
  return {
    roomManager,
    userManager,
    editorManager,
    getStats,
    cleanup,
    shutdown,

    // Funciones de utilidad expuestas
    utils: {
      broadcastRoomsList: () => broadcastRoomsList(io, roomManager),
      logEvent: logServerEvent,
      getHealth: () => getServerHealth(roomManager, userManager),
    },
  };
}
