import { io } from "socket.io-client";
import { EditorSynchronizer } from "./collaboration/EditorSynchronizer.js";

class CollaborationManager {
  constructor(editor, serverUrls = null) {
    this.editor = editor;

    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (serverUrls) {
      this.serverUrls = Array.isArray(serverUrls) ? serverUrls : [serverUrls];
    } else if (isLocal) {
      // 🧪 Modo desarrollo: conecta directo a los puertos del backend
      this.serverUrls = [
        import.meta.env.VITE_SERVER_URL || "http://localhost:3001",
        "http://localhost:3002",
      ];
    } else {
      // 🚀 Producción: usa el mismo dominio que sirve el front
      const baseUrl =
        import.meta.env.VITE_SERVER_URL ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "https://threelinker.genodev.com.co");

      this.serverUrls = [baseUrl];
    }

    this.currentServerIndex = 0;
    this.serverUrl = this.serverUrls[0];
    this.socket = null;
    this.currentRoom = null;
    this.isConnected = false;
    this.isHost = false;
    this.isWaitingForInitialSync = false;
    this.connectedUsers = new Map();
    this.userName = localStorage.getItem("collaboration-username") || "Anónimo";
    this.repositionTimeout = null;
    this.editorSynchronizer = null;

    // Control de failover
    this.failoverInProgress = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.connectionTimeout = 8000; // 8 segundos

    this.init();
  }

  init() {
    this.connectToServer();
    this.setupResizeHandlers();
  }

  /**
   * Conecta al servidor actual con failover automático
   */
  connectToServer() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.serverUrl = this.serverUrls[this.currentServerIndex];

    console.log(
      `🔄 Conectando a servidor: ${this.serverUrl} (intento ${
        this.connectionAttempts + 1
      })`
    );

    this.socket = io(this.serverUrl, {
      path: "/socket.io",
      withCredentials: true,
      timeout: this.connectionTimeout,
      reconnection: false, // Manejamos reconexión manualmente
      forceNew: true,
      upgrade: true,
      rememberUpgrade: true,
      transports: ["websocket", "polling"],
      pingTimeout: 30000,
      pingInterval: 15000,
    });

    this.setupSocketListeners();
    this.setupFailoverHandling();

    // Timeout para conexión
    const connectionTimer = setTimeout(() => {
      if (!this.isConnected) {
        console.warn(`⏰ Timeout conectando a ${this.serverUrl}`);
        this.tryNextServer();
      }
    }, this.connectionTimeout);

    // Limpiar timer al conectar
    this.socket.once("connect", () => {
      clearTimeout(connectionTimer);
      this.connectionAttempts = 0;
    });
  }

  /**
   * Configurar manejo de failover
   */
  setupFailoverHandling() {
    this.socket.on("connect_error", (error) => {
      console.error(`❌ Error conectando a ${this.serverUrl}:`, error);

      // Verificar si es redirección por sticky routing
      if (error.message && error.message.startsWith("REDIRECT:")) {
        const redirectUrl = error.message.split("REDIRECT:")[1];
        console.log(`🔄 Redirección sticky routing: ${redirectUrl}`);
        this.handleStickyRedirect(redirectUrl);
        return;
      }

      this.tryNextServer();
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.warn(`🔌 Desconectado de ${this.serverUrl}. Razón: ${reason}`);

      if (reason === "io server disconnect" || reason === "transport close") {
        this.tryNextServer();
      }
    });
  }

  /**
   * Manejar redirección por sticky routing
   */
  handleStickyRedirect(redirectUrl) {
    const serverIndex = this.serverUrls.indexOf(redirectUrl);

    if (serverIndex !== -1) {
      console.log(
        `🎯 Cambiando a servidor correcto para roomId: ${redirectUrl}`
      );
      this.currentServerIndex = serverIndex;
      this.connectToServer();
    } else {
      console.warn(`⚠️  URL de redirección no válida: ${redirectUrl}`);
      this.tryNextServer();
    }
  }

  /**
   * Intentar siguiente servidor en failover
   */
  tryNextServer() {
    if (this.failoverInProgress) {
      return;
    }

    this.failoverInProgress = true;
    this.connectionAttempts++;

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      // Intentar siguiente servidor
      this.currentServerIndex =
        (this.currentServerIndex + 1) % this.serverUrls.length;
      this.connectionAttempts = 0;

      console.log(
        `🔄 Failover al servidor ${this.currentServerIndex + 1}: ${
          this.serverUrls[this.currentServerIndex]
        }`
      );
    }

    // Reconectar después de un delay
    setTimeout(() => {
      this.failoverInProgress = false;
      this.connectToServer();
    }, 2000);
  }

  /**
   * Calcular servidor óptimo por roomId para sticky routing
   */
  getServerForRoomId(roomId) {
    if (!roomId) return this.serverUrls[0];

    // Hash simple para distribución consistente
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const serverIndex = Math.abs(hash) % this.serverUrls.length;
    return this.serverUrls[serverIndex];
  }

  /**
   * Inicializa el sincronizador de escenas
   */
  initializeEditorSynchronizer() {
    this.editorSynchronizer = new EditorSynchronizer(
      this.editor,
      this.socket,
      this
    );
  }

  /**
   * Configura todos los event listeners de Socket.IO
   */
  setupSocketListeners() {
    this.setupConnectionEvents();
    this.setupRoomEvents();
    this.setupUserEvents();
  }

  /**
   * Aplica resize handlers para reposicionar elementos UI
   */
  setupResizeHandlers() {
    window.addEventListener("resize", () => {
      this.repositionElements();
    });

    // Observador para cambios en el DOM que puedan afectar el layout
    if (globalThis.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        this.repositionElements();
      });

      resizeObserver.observe(document.body);

      const editorContainer =
        document.getElementById("editor") ||
        document.querySelector(".editor") ||
        document.querySelector("main");
      if (editorContainer) {
        resizeObserver.observe(editorContainer);
      }
    }
  }

  /**
   * Eventos de conexión/desconexión
   */
  setupConnectionEvents() {
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.showConnectionStatus("Conectado", "success");

      // Inicializar EditorSynchronizer una vez que el socket esté conectado
      if (!this.editorSynchronizer) {
        this.initializeEditorSynchronizer();
      }

      setTimeout(() => {
        if (this.isConnected) {
          this.socket.emit("get-rooms");
        }
      }, 500);
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      this.showConnectionStatus("Desconectado", "error");

      if (reason === "io server disconnect") {
        this.socket.connect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("[CollaborationManager] Connection error:", error);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      this.isConnected = true;
      this.showConnectionStatus("Reconectado", "success");
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      this.showConnectionStatus("Reconectando...", "warning");
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("[CollaborationManager] Reconnection error:", error);
    });

    this.socket.on("reconnect_failed", () => {
      this.showNotification("No se pudo reconectar al servidor", "error");
    });
  }

  /**
   * Eventos relacionados con salas
   */
  setupRoomEvents() {
    this.socket.on("room-created", (data) => {
      this.currentRoom = data.roomId;
      this.isHost = data.isHost;
      this.showNotification(
        `Sala "${data.roomId}" creada exitosamente`,
        "success"
      );
      this.updateCollaborationPanel();

      // Configurar modo host en scene synchronizer
      if (this.editorSynchronizer) {
        this.editorSynchronizer.setHostStatus(true);
      }
    });

    this.socket.on("room-creation-failed", (data) => {
      this.showNotification(`Error: ${data.error}`, "error");
    });

    this.socket.on("joined-room", (data) => {
      this.currentRoom = data.roomId;
      this.isHost = data.isHost;
      this.showNotification(`Te uniste a la sala "${data.roomId}"`, "success");
      this.updateCollaborationPanel();

      if (this.editorSynchronizer) {
        this.editorSynchronizer.setHostStatus(this.isHost);
      }
    });

    this.socket.on("join-room-failed", (data) => {
      this.showNotification(`Error: ${data.error}`, "error");
    });

    this.socket.on("left-room", (data) => {
      if (data.success) {
        this.currentRoom = null;
        this.isHost = false;
        this.showNotification("Saliste de la sala", "info");
        this.updateCollaborationPanel();

        // Resetear editor synchronizer
        if (this.editorSynchronizer) {
          this.editorSynchronizer.setHostStatus(false);
        }
      }
    });

    this.socket.on("room-deleted", (data) => {
      this.currentRoom = null;
      this.isHost = false;
      this.showNotification(data.message, "error");
      this.updateCollaborationPanel();

      // Resetear editor synchronizer
      if (this.editorSynchronizer) {
        this.editorSynchronizer.setHostStatus(false);
      }
    });

    this.socket.on("rooms-list", (rooms) => {
      globalThis.collaborationPanel?.updateAvailableRooms?.(rooms);
    });
  }

  /**
   * Eventos relacionados con usuarios
   */
  setupUserEvents() {
    this.socket.on("user-joined", (data) => {
      this.showNotification(`${data.userName} se unió a la sala`, "info");
    });

    this.socket.on("user-left", (data) => {
      this.showNotification(`${data.userName} salió de la sala`, "info");
    });

    this.socket.on("users-list", (users) => {
      globalThis.collaborationPanel?.updateUsersList?.(users);
    });

    this.socket.on("user-count", (count) => {
      globalThis.collaborationPanel?.updateUserCount?.(count);
    });

    this.socket.on("user-name-changed", (data) => {
      this.showNotification(
        `${data.oldName} cambió su nombre a ${data.userName}`,
        "info"
      );
    });
  }

  // Método para reposicionar todos los elementos del colaboración
  repositionElements() {
    clearTimeout(this.repositionTimeout);
    this.repositionTimeout = setTimeout(() => {
      globalThis.collaborationPanel?.repositionPanel();
    }, 100);
  }

  getRooms() {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("No conectado al servidor"));
        return;
      }

      // Usar timeout para evitar que se cuelgue indefinidamente
      const timeout = setTimeout(() => {
        reject(new Error("Timeout al obtener salas"));
      }, 5000);

      // Configurar listener temporal para la respuesta
      const handleRoomsResponse = (data) => {
        clearTimeout(timeout);
        this.socket.off("rooms-list", handleRoomsResponse);
        resolve(data);
      };

      this.socket.once("rooms-list", handleRoomsResponse);
      this.socket.emit("get-rooms");
    });
  }

  createRoom(roomId, password = null) {
    if (!this.isConnected) {
      this.showNotification("No conectado al servidor", "error");
      return;
    }

    if (this.currentRoom) {
      this.showNotification(
        `Ya te encuentras vinculado en la sala "${this.currentRoom}".`,
        "error"
      );
      return;
    }

    // Verificar si necesitamos cambiar de servidor por sticky routing
    const targetServerUrl = this.getServerForRoomId(roomId);
    const currentServerUrl = this.serverUrls[this.currentServerIndex];

    if (targetServerUrl !== currentServerUrl) {
      console.log(
        `🎯 Cambiando servidor para crear roomId ${roomId}: ${targetServerUrl}`
      );

      // Cambiar al servidor correcto
      const targetServerIndex = this.serverUrls.indexOf(targetServerUrl);
      if (targetServerIndex !== -1) {
        this.currentServerIndex = targetServerIndex;

        // Preservar información de la sala para crear después
        const createData = { roomId, password, userName: this.userName };

        this.showNotification(
          `Cambiando a servidor optimizado para crear la sala...`,
          "info"
        );

        // Desconectar y reconectar al servidor correcto
        this.socket.disconnect();

        setTimeout(() => {
          this.connectToServer();

          // Una vez reconectado, crear la sala
          const waitForConnection = () => {
            if (this.isConnected) {
              this._createRoomDirect(createData);
            } else {
              setTimeout(waitForConnection, 500);
            }
          };

          setTimeout(waitForConnection, 1000);
        }, 500);

        return;
      }
    }

    // Crear directamente si ya estamos en el servidor correcto
    this._createRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Método interno para crear una sala directamente
   */
  _createRoomDirect({ roomId, password, userName }) {
    this.socket.emit("create-room", {
      roomId: roomId,
      userName: userName,
      password: password,
    });

    this.showNotification(`Creando sala: ${roomId}...`, "info");
  }

  joinRoom(roomId, password = null) {
    if (!this.isConnected) {
      this.showNotification("No conectado al servidor", "error");
      return;
    }

    if (this.currentRoom) {
      const action = this.isHost ? "elimina" : "sal de";
      this.showNotification(
        `Ya estás en la sala "${this.currentRoom}". ${
          action.charAt(0).toUpperCase() + action.slice(1)
        } la sala actual primero.`,
        "error"
      );
      return;
    }

    // Verificar si necesitamos cambiar de servidor por sticky routing
    const targetServerUrl = this.getServerForRoomId(roomId);
    const currentServerUrl = this.serverUrls[this.currentServerIndex];

    if (targetServerUrl !== currentServerUrl) {
      console.log(
        `🎯 Cambiando servidor para roomId ${roomId}: ${targetServerUrl}`
      );

      // Cambiar al servidor correcto
      const targetServerIndex = this.serverUrls.indexOf(targetServerUrl);
      if (targetServerIndex !== -1) {
        this.currentServerIndex = targetServerIndex;

        // Preservar información de la sala para reconectar
        const rejoinData = { roomId, password, userName: this.userName };

        this.showNotification(
          `Cambiando a servidor optimizado para la sala...`,
          "info"
        );

        // Desconectar y reconectar al servidor correcto
        this.socket.disconnect();

        setTimeout(() => {
          this.connectToServer();

          // Una vez reconectado, unirse a la sala
          const waitForConnection = () => {
            if (this.isConnected) {
              this._joinRoomDirect(rejoinData);
            } else {
              setTimeout(waitForConnection, 500);
            }
          };

          setTimeout(waitForConnection, 1000);
        }, 500);

        return;
      }
    }

    // Unirse directamente si ya estamos en el servidor correcto
    this._joinRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Método interno para unirse a una sala directamente
   */
  _joinRoomDirect({ roomId, password, userName }) {
    this.socket.emit("join-room", {
      roomId: roomId,
      userName: userName,
      password: password,
    });

    this.showNotification(`Intentando unirse a la sala: ${roomId}...`, "info");
  }

  leaveRoom() {
    if (this.currentRoom) {
      const wasHost = this.isHost;

      this.socket.emit("leave-room", this.currentRoom);

      this.currentRoom = null;
      this.isHost = false;
      this.isWaitingForInitialSync = false;
      this.connectedUsers.clear();

      if (wasHost) {
        this.showNotification("Saliste de la sala", "info");
      } else {
        this.editor.clear();
        this.showNotification("Saliste de la sala. Escena limpiada.", "info");
      }

      this.updateRoomDisplay(null);
      this.updateUserCount(0);
      globalThis.collaborationPanel?.updateUsersList?.([]);

      setTimeout(() => {
        if (this.isConnected) {
          if (this.isConnected) {
            this.socket.emit("get-rooms");
          }
        }
      }, 500);
    }
  }

  deleteRoom() {
    if (!this.isConnected) {
      this.showNotification("No conectado al servidor", "error");
      return;
    }

    if (!this.currentRoom) {
      this.showNotification("No estás en ninguna sala", "error");
      return;
    }

    if (!this.isHost) {
      this.showNotification(
        "Solo el anfitrión puede eliminar la sala",
        "error"
      );
      return;
    }

    this.showConfirmDialog(
      "Eliminar Sala",
      `¿Estás seguro de que quieres eliminar la sala "${this.currentRoom}"?\n\nEsta acción desconectará a todos los usuarios invitados y eliminará la sala permanentemente. Tu escena se mantendrá intacta.`,
      () => {
        this.socket.emit("delete-room", {
          roomId: this.currentRoom,
        });

        this.showNotification(
          `Eliminando sala: ${this.currentRoom}...`,
          "info"
        );
      },

      () => {}
    );
  }

  generateRoomId() {
    return "room_" + Math.random().toString(36).substring(2, 11);
  }

  updateUserName(newName) {
    this.userName = newName;
    localStorage.setItem("collaboration-username", newName);

    // Notificar al servidor sobre el cambio de nombre
    if (this.isConnected && this.currentRoom) {
      this.socket.emit("user-name-change", {
        roomId: this.currentRoom,
        userName: newName,
      });
    }

    this.showNotification(`Tu nombre cambió a: ${newName}`, "info");
  }

  // Mostrar estado de conexión
  showConnectionStatus(message, type) {
    let statusElement = document.getElementById("collaboration-status");
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.id = "collaboration-status";
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = message;
    statusElement.className = `status-${type}`;
  }

  // Mostrar diálogo de confirmación personalizado
  showConfirmDialog(title, message, onConfirm, onCancel = null) {
    // Crear overlay
    const overlay = document.createElement("div");
    overlay.id = "collaboration-confirm-overlay";
    overlay.className = "collaboration-confirm-overlay";

    // Crear diálogo
    const dialog = document.createElement("div");
    dialog.className = "collaboration-dialog";

    // Título
    const titleEl = document.createElement("div");
    titleEl.className = "collaboration-dialog-title";
    titleEl.innerHTML = `🗑️ ${title}`;

    // Mensaje
    const messageEl = document.createElement("div");
    messageEl.className = "collaboration-dialog-message";
    messageEl.textContent = message;

    // Contenedor de botones
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "collaboration-dialog-buttons";

    // Botón cancelar
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancelar";
    cancelBtn.className = "collaboration-dialog-btn cancel";

    // Botón confirmar
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Eliminar Sala";
    confirmBtn.className = "collaboration-dialog-btn confirm";

    // Event listeners
    const closeDialog = () => {
      overlay.style.animation = "fadeOut 0.2s ease-out";
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 200);
    };

    cancelBtn.addEventListener("click", () => {
      closeDialog();
      if (onCancel) onCancel();
    });

    confirmBtn.addEventListener("click", () => {
      closeDialog();
      onConfirm();
    });

    // Cerrar con ESC
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeDialog();
        document.removeEventListener("keydown", handleKeyDown);
        if (onCancel) onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Cerrar clickeando fuera
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeDialog();
        if (onCancel) onCancel();
      }
    });

    // Ensamblar diálogo
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(confirmBtn);
    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonsContainer);
    overlay.appendChild(dialog);

    // Mostrar diálogo
    document.body.appendChild(overlay);

    // Focus en el botón cancelar por defecto
    setTimeout(() => cancelBtn.focus(), 100);
  }

  showNotification(message, type = "info") {
    let container = document.getElementById("notifications-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "notifications-container";
      container.className = "notifications-container";
      document.body.appendChild(container);
    }

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Auto-eliminar después de 4 segundos con animación
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideOutToRight 0.3s ease-out";
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }

          if (container.children.length === 0) {
            if (container.parentNode) {
              container.remove();
            }
          }
        }, 300);
      }
    }, 4000);
  }

  // Actualizar contador de usuarios
  updateUserCount(count) {
    let userCountElement = document.getElementById("user-count");
    if (!userCountElement) {
      userCountElement = document.createElement("div");
      userCountElement.id = "user-count";
      document.body.appendChild(userCountElement);
    }

    if (count > 0) {
      userCountElement.textContent = `👥 ${count} usuario${
        count === 1 ? "" : "s"
      }`;
      userCountElement.style.display = "block";
    } else {
      userCountElement.style.display = "none";
    }
  }

  // Actualizar display de sala actual
  updateRoomDisplay(roomId) {
    let roomElement = document.getElementById("current-room");
    if (!roomElement) {
      roomElement = document.createElement("div");
      roomElement.id = "current-room";
      document.body.appendChild(roomElement);
    }

    if (roomId) {
      roomElement.textContent = `🏠 Sala: ${roomId}`;
      roomElement.style.display = "block";
    } else {
      roomElement.style.display = "none";
    }

    // Actualizar panel UI también
    globalThis.collaborationPanel?.updateCurrentRoom?.(roomId);
  }

  // Actualizar el panel de colaboración
  updateCollaborationPanel() {
    if (globalThis.collaborationPanel) {
      globalThis.collaborationPanel.updateConnectionStatus(
        this.isConnected,
        !!this.currentRoom
      );
      globalThis.collaborationPanel.updateCurrentRoom(this.currentRoom);
    }
  }

  /**
   * Sincroniza el editor completo (para objetos importados)
   */
  syncFullEditor() {
    if (this.editorSynchronizer && this.currentRoom) {
      this.editorSynchronizer.sendFullEditorToServer();
    }
  }
}

export { CollaborationManager };
