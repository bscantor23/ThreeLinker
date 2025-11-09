import { io } from "socket.io-client";
import { EditorSynchronizer } from "./collaboration/EditorSynchronizer.js";

class CollaborationManager {
  constructor(editor, serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001") {
    this.editor = editor;
    this.serverUrl = serverUrl;
    this.socket = null;
    this.currentRoom = null;
    this.isConnected = false;
    this.isHost = false;
    this.isWaitingForInitialSync = false;
    this.connectedUsers = new Map();
    this.userName = localStorage.getItem("collaboration-username") || "Anónimo";
    this.repositionTimeout = null;
    this.editorSynchronizer = null;
    this.init();
  }

  init() {
    this.socket = io(this.serverUrl, {
      timeout: 60000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      maxReconnectionAttempts: 10,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: true,
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupSocketListeners();
    this.setupResizeHandlers();
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

    this.socket.emit("create-room", {
      roomId: roomId,
      userName: this.userName,
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

    this.socket.emit("join-room", {
      roomId: roomId,
      userName: this.userName,
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
