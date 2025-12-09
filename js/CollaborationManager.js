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
          : "https://linker.genodev.com.co");

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

    // Control de failover mejorado
    this.failoverInProgress = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.connectionTimeout = 8000; // 8 segundos

    // Cache y listado unificado de salas
    this.allRoomsCache = new Map();
    this.roomsCacheTimeout = 30000; // 30 segundos
    this.lastRoomsUpdate = 0;
    this.isLoadingRooms = false;
    this.serverLatencies = new Map();
    this.unifiedRooms = []; // Lista unificada de salas de todos los servidores

    this.init();
  }

  init() {
    this.connectToServer();
    this.setupResizeHandlers();
    this.setupUnifiedRoomsUpdater();
    this.setupLatencyMonitoring();
  }

  /**
   * Configura la medición automática de latencias
   */
  setupLatencyMonitoring() {
    // Medir latencias cada 60 segundos
    setInterval(async () => {
      if (this.isConnected) {
        await this.measureServerLatencies();
      }
    }, 60000);

    // Primera medición después de conectar
    setTimeout(async () => {
      if (this.isConnected) {
        await this.measureServerLatencies();
      }
    }, 2000);
  }

  /**
   * Configura la actualización automática de salas unificadas
   */
  setupUnifiedRoomsUpdater() {
    // Actualizar salas unificadas cada 30 segundos
    setInterval(() => {
      if (!this.isLoadingRooms) {
        this.fetchUnifiedRooms();
      }
    }, 30000);

    // Primera actualización después de conectar
    setTimeout(() => {
      if (this.isConnected) {
        this.fetchUnifiedRooms();
      }
    }, 1000);
  }

  /**
   * Obtiene las salas unificadas de todos los servidores con cache inteligente
   */
  async fetchUnifiedRooms() {
    if (this.isLoadingRooms) return this.unifiedRooms;
    
    // Verificar cache
    const now = Date.now();
    if (now - this.lastRoomsUpdate < this.roomsCacheTimeout && this.unifiedRooms.length > 0) {
      return this.unifiedRooms;
    }

    this.isLoadingRooms = true;
    this.showNotification("🔄 Actualizando lista de salas...", "info");

    try {
      // Obtener salas desde el servidor actual (que debe tener acceso a todas via Redis)
      const roomsResponse = await this.fetchFromEndpoint('/api/all-rooms');
      
      if (roomsResponse && roomsResponse.success) {
        this.unifiedRooms = roomsResponse.rooms || [];
        this.lastRoomsUpdate = now;
        
        // Actualizar cache y UI
        this.updateRoomsCache();
        this.updateAvailableRooms(this.unifiedRooms);
        
        this.showNotification(`✅ ${this.unifiedRooms.length} salas disponibles`, "success");
        console.log(`📋 Salas obtenidas:`, this.unifiedRooms);
        
        return this.unifiedRooms;
      }
    } catch (error) {
      console.error('Error obteniendo salas unificadas:', error);
      this.showNotification("⚠️ Error actualizando salas", "warning");
    } finally {
      this.isLoadingRooms = false;
    }
    
    return this.unifiedRooms;
  }

  /**
   * Hace request a un endpoint específico del servidor actual
   */
  async fetchFromEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout'));
      }, 5000);

      fetch(`${this.serverUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      .then(async response => {
        clearTimeout(timeout);
        
        // Verificar si la respuesta es exitosa
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Verificar Content-Type para asegurar que es JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // Intentar leer el texto para mostrar mejor información del error
          const text = await response.text();
          console.error(`Respuesta no-JSON del servidor ${this.serverUrl}${endpoint}:`, {
            status: response.status,
            statusText: response.statusText,
            contentType,
            bodyPreview: text.substring(0, 200)
          });
          throw new Error(`Respuesta no-JSON recibida. Status: ${response.status}`);
        }
        
        // Parsear JSON solo después de verificar que es válido
        return response.json();
      })
      .then(data => {
        resolve(data);
      })
      .catch(error => {
        console.error(`Error en fetchFromEndpoint ${endpoint}:`, error);
        reject(error);
      });
    });
  }

  /**
   * Actualiza el cache local de salas
   */
  updateRoomsCache() {
    this.unifiedRooms.forEach(room => {
      this.allRoomsCache.set(room.id, {
        ...room,
        cachedAt: Date.now(),
        serverLatency: this.serverLatencies.get(room.serverInstance) || 0
      });
    });
  }

  /**
   * Mide la latencia de los servidores
   */
  async measureServerLatencies() {
    const promises = this.serverUrls.map(async (serverUrl, index) => {
      try {
        const start = Date.now();
        await this.fetchFromServer(serverUrl, '/api/health');
        const latency = Date.now() - start;
        this.serverLatencies.set(`server-${index + 1}`, latency);
        return { server: `server-${index + 1}`, latency };
      } catch (error) {
        this.serverLatencies.set(`server-${index + 1}`, -1);
        return { server: `server-${index + 1}`, latency: -1 };
      }
    });

    const results = await Promise.all(promises);
    console.log('📊 Latencias de servidores:', results);
    return results;
  }

  /**
   * Hace request a un servidor específico
   */
  async fetchFromServer(serverUrl, endpoint) {
    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Obtiene servidor óptimo para una sala específica
   */
  getOptimalServerForRoom(roomId) {
    if (!roomId) return this.serverUrls[0];

    // Usar hash consistente para sticky routing
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    
    const serverIndex = Math.abs(hash) % this.serverUrls.length;
    return this.serverUrls[serverIndex];
  }

  /**
   * Método mejorado para crear sala con failover transparente
   */
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

    // Mostrar mensaje informativo durante la transición
    this.showLoadingMessage("🌟 Creando sala con servidor optimizado...");

    // Determinar servidor óptimo para la sala
    const optimalServerUrl = this.getOptimalServerForRoom(roomId);
    const currentServerUrl = this.serverUrls[this.currentServerIndex];

    if (optimalServerUrl !== currentServerUrl) {
      console.log(`🎯 Cambiando a servidor óptimo para crear sala ${roomId}: ${optimalServerUrl}`);
      
      // Cambiar al servidor óptimo
      const targetServerIndex = this.serverUrls.indexOf(optimalServerUrl);
      if (targetServerIndex !== -1) {
        this.currentServerIndex = targetServerIndex;
        this.performServerSwitch(optimalServerUrl, () => {
          this._createRoomDirect({ roomId, password, userName: this.userName });
        });
        return;
      }
    }

    // Crear directamente en el servidor actual
    this._createRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Método mejorado para unirse a sala con failover transparente
   */
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

    // Mostrar mensaje informativo durante la transición
    this.showLoadingMessage("🔗 Conectando a sala con servidor optimizado...");

    // Determinar servidor óptimo para la sala
    const optimalServerUrl = this.getOptimalServerForRoom(roomId);
    const currentServerUrl = this.serverUrls[this.currentServerIndex];

    if (optimalServerUrl !== currentServerUrl) {
      console.log(`🎯 Cambiando a servidor óptimo para sala ${roomId}: ${optimalServerUrl}`);
      
      // Cambiar al servidor óptimo
      const targetServerIndex = this.serverUrls.indexOf(optimalServerUrl);
      if (targetServerIndex !== -1) {
        this.currentServerIndex = targetServerIndex;
        this.performServerSwitch(optimalServerUrl, () => {
          this._joinRoomDirect({ roomId, password, userName: this.userName });
        });
        return;
      }
    }

    // Unirse directamente en el servidor actual
    this._joinRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Realiza cambio de servidor con UX mejorada
   */
  performServerSwitch(newServerUrl, callback) {
    // Preservar estado actual
    const preservedState = {
      currentRoom: this.currentRoom,
      isHost: this.isHost,
      userName: this.userName
    };

    // Mostrar notificación de cambio
    this.showNotification(`🔄 Cambiando a servidor optimizado...`, "info");

    // Desconectar del servidor actual
    if (this.socket) {
      this.socket.disconnect();
    }

    // Reconectar al nuevo servidor
    setTimeout(() => {
      this.serverUrl = newServerUrl;
      this.connectToServer();

      // Una vez conectado, ejecutar callback
      const waitForConnection = () => {
        if (this.isConnected) {
          this.showNotification(`✅ Conectado a servidor optimizado`, "success");
          callback();
        } else {
          setTimeout(waitForConnection, 500);
        }
      };

      setTimeout(waitForConnection, 1000);
    }, 500);
  }

  /**
   * Muestra mensaje de carga informativo
   */
  showLoadingMessage(message) {
    this.showNotification(message, "info");
  }

  /**
   * Método sobrescrito para obtener salas con cache
   */
  getRooms() {
    return new Promise(async (resolve, reject) => {
      try {
        // Intentar obtener salas unificadas primero
        const rooms = await this.fetchUnifiedRooms();
        if (rooms && rooms.length > 0) {
          resolve(rooms);
          return;
        }
      } catch (error) {
        console.warn('Error obteniendo salas unificadas, usando fallback:', error);
      }

      // Fallback al método original
      if (!this.isConnected) {
        reject(new Error("No conectado al servidor"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Timeout al obtener salas"));
      }, 5000);

      const handleRoomsResponse = (data) => {
        clearTimeout(timeout);
        this.socket.off("rooms-list", handleRoomsResponse);
        resolve(data);
      };

      this.socket.once("rooms-list", handleRoomsResponse);
      this.socket.emit("get-rooms");
    });
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
      // Combinar salas del socket con salas unificadas cacheadas
      const combinedRooms = this.combineSocketRoomsWithUnified(rooms);
      globalThis.collaborationPanel?.updateAvailableRooms?.(combinedRooms);
    });

    // Evento para salas unificadas
    this.socket.on("unified-rooms-list", (rooms) => {
      this.unifiedRooms = rooms;
      this.updateAvailableRooms(rooms);
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
   * Combina salas del socket con salas unificadas cacheadas
   */
  combineSocketRoomsWithUnified(socketRooms) {
    if (!socketRooms || !Array.isArray(socketRooms)) {
      return this.unifiedRooms;
    }

    // Crear mapa de salas unificadas por ID
    const unifiedMap = new Map();
    this.unifiedRooms.forEach(room => {
      unifiedMap.set(room.id, room);
    });

    // Combinar con salas del socket actual
    socketRooms.forEach(socketRoom => {
      const existingRoom = unifiedMap.get(socketRoom.id);
      if (existingRoom) {
        // Actualizar información si es necesario
        unifiedMap.set(socketRoom.id, {
          ...existingRoom,
          ...socketRoom,
          isCurrentServer: true // Marcar como del servidor actual
        });
      } else {
        // Agregar sala nueva del socket
        unifiedMap.set(socketRoom.id, {
          ...socketRoom,
          serverInstance: 'current',
          serverUrl: this.serverUrl,
          isCurrentServer: true
        });
      }
    });

    return Array.from(unifiedMap.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Actualiza la lista de salas disponibles en la UI con información del servidor
   */
  updateAvailableRooms(rooms) {
    if (!rooms || !Array.isArray(rooms)) return;

    // Enriquecer salas con información visual del servidor
    const enrichedRooms = rooms.map(room => ({
      ...room,
      serverBadge: this.getServerBadge(room.serverInstance),
      serverColor: this.getServerColor(room.serverInstance),
      serverLatency: this.serverLatencies.get(room.serverInstance) || 0,
      isOptimal: this.isOptimalServerForRoom(room.id),
      displayInfo: this.getRoomDisplayInfo(room)
    }));

    // Actualizar UI
    globalThis.collaborationPanel?.updateAvailableRooms?.(enrichedRooms);
    
    console.log('🏠 Salas actualizadas en UI:', enrichedRooms);
  }

  /**
   * Obtiene badge visual para el servidor
   */
  getServerBadge(serverInstance) {
    const currentInstance = this.getCurrentServerInstance();
    
    if (serverInstance === currentInstance) {
      return '🟢 Local';
    } else if (serverInstance && serverInstance !== 'local') {
      return '🔵 Remoto';
    } else {
      return '⚪ Desconocido';
    }
  }

  /**
   * Obtiene color para el servidor
   */
  getServerColor(serverInstance) {
    const currentInstance = this.getCurrentServerInstance();
    
    if (serverInstance === currentInstance) {
      return '#28a745'; // Verde para servidor actual
    } else if (serverInstance && serverInstance !== 'local') {
      return '#007bff'; // Azul para servidor remoto
    } else {
      return '#6c757d'; // Gris para desconocido
    }
  }

  /**
   * Obtiene la instancia del servidor actual
   */
  getCurrentServerInstance() {
    const port = this.serverUrl.includes('3001') ? 'server-1' : 
                 this.serverUrl.includes('3002') ? 'server-2' : 'current';
    return port;
  }

  /**
   * Verifica si el servidor actual es óptimo para la sala
   */
  isOptimalServerForRoom(roomId) {
    const optimalServer = this.getOptimalServerForRoom(roomId);
    return optimalServer === this.serverUrl;
  }

  /**
   * Obtiene información de display para la sala
   */
  getRoomDisplayInfo(room) {
    const latency = this.serverLatencies.get(room.serverInstance);
    const isOptimal = this.isOptimalServerForRoom(room.id);
    
    let info = [];
    
    if (latency !== undefined && latency > 0) {
      info.push(`${latency}ms`);
    }
    
    if (isOptimal) {
      info.push('⚡ Óptimo');
    }
    
    if (room.userCount > 0) {
      info.push(`${room.userCount}👥`);
    }
    
    return info.join(' • ');
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
