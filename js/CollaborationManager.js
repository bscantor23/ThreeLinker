import { io } from "socket.io-client";
import { EditorSynchronizer } from "./collaboration/EditorSynchronizer.js";

class CollaborationManager {
  constructor(editor, serverUrls = null) {
    this.editor = editor;

    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    console.log('🔍 Debug - Detección de entorno:', {
      hostname: typeof window !== "undefined" ? window.location.hostname : 'undefined',
      isLocal,
      mode: import.meta.env.MODE,
      viteServerUrl: import.meta.env.VITE_SERVER_URL,
      origin: typeof window !== "undefined" ? window.location.origin : 'undefined'
    });

    if (serverUrls) {
      this.serverUrls = Array.isArray(serverUrls) ? serverUrls : [serverUrls];
      console.log('🔧 Usando URLs proporcionadas:', this.serverUrls);
    } else if (isLocal) {
      // 🧪 Modo desarrollo: conecta directo a los puertos del backend
      let devServerUrl = import.meta.env.VITE_SERVER_URL;

      // Validar si VITE_SERVER_URL es válido (debe tener puerto numérico)
      if (devServerUrl) {
        const portMatch = devServerUrl.match(/:(\d+)/);
        if (!portMatch) {
          console.warn('⚠️ VITE_SERVER_URL sin puerto válido detectado:', devServerUrl, 'usando fallback');
          devServerUrl = null;
        } else {
          console.log('✅ VITE_SERVER_URL con puerto válido:', devServerUrl);
        }
      }

      this.serverUrls = [
        devServerUrl || "http://localhost:3001",
        "http://localhost:3002",
      ];
      console.log('🧪 Modo desarrollo - URLs configuradas:', this.serverUrls);
    } else {
      // 🚀 Producción: usar dominio de producción
      const baseUrl =
        import.meta.env.VITE_SERVER_URL ||
        (typeof window !== "undefined"
          ? window.location.origin
          : null);

      // En producción, solo usar localhost si explícitamente está configurado
      // Y solo si estamos realmente en entorno de desarrollo
      if (baseUrl && baseUrl.includes('localhost') && isLocal) {
        // Solo para desarrollo local explícito
        this.serverUrls = [
          "http://localhost:3001",
          "http://localhost:3002",
        ];
        console.log('🔧 Desarrollo local detectado - URLs configuradas:', this.serverUrls);
      } else if (baseUrl && !baseUrl.includes('localhost')) {
        // Producción con dominio válido
        this.serverUrls = [baseUrl];
        console.log('🚀 Producción con dominio - URLs configuradas:', this.serverUrls);
      } else {
        // Fallback: usar el origen actual (para casos edge)
        this.serverUrls = baseUrl ? [baseUrl] : [];
        console.log('⚠️ Fallback de configuración - URLs:', this.serverUrls);
      }
    }

    // Verificar que tengamos URLs válidas
    if (this.serverUrls.length === 0) {
      if (isLocal) {
        // Solo en desarrollo local usar fallback localhost
        console.warn('⚠️ No se encontraron URLs de servidor válidas, usando fallback de desarrollo local');
        this.serverUrls = [
          "http://localhost:3001",
          "http://localhost:3002",
        ];
      } else {
        // En producción, usar el origen actual como fallback
        console.warn('⚠️ No se encontraron URLs de servidor válidas, usando fallback de producción');
        const currentOrigin = typeof window !== "undefined" ? window.location.origin : null;
        this.serverUrls = currentOrigin ? [currentOrigin] : [];
      }
    }

    console.log('🌐 URLs de servidor FINAL configuradas:', this.serverUrls);

    this.currentServerIndex = 0;
    this.serverUrl = this.serverUrls[0];
    this.socket = null;
    this.currentRoom = null;
    this.pendingRoomId = null; // Room we're about to join (for sticky routing)
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
    this.maxConnectionAttempts = 1;
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

    try {
      // Obtener salas desde el servidor actual (que debe tener acceso a todas via Redis)
      const roomsResponse = await this.fetchFromEndpoint('/api/all-rooms');

      if (roomsResponse && roomsResponse.success) {
        this.unifiedRooms = roomsResponse.rooms || [];
        this.lastRoomsUpdate = now;

        // Actualizar cache y UI de forma transparente
        this.updateRoomsCache();
        this.updateAvailableRooms(this.unifiedRooms);

        console.log(`📋 Salas obtenidas:`, this.unifiedRooms);

        return this.unifiedRooms;
      }
    } catch (error) {
      console.error('Error obteniendo salas unificadas:', error);
      // Solo mostrar error en casos críticos, no para updates transparentes
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
  // getOptimalServerForRoom removed (legacy hash logic)


  /**
   * Método mejorado para crear sala con failover transparente
   */
  // Legacy createRoom/joinRoom removed from here. Using main definitions below.


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
      `🔄 Conectando a servidor: ${this.serverUrl} (intento ${this.connectionAttempts + 1
      })`
    );

    const connectionOptions = {
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
    };

    // [CRITICAL] Enviar roomId para Sticky Routing en Nginx/Load Balancer
    const roomIdForRouting = this.currentRoom || this.pendingRoomId;
    if (roomIdForRouting) {
      console.log(`📎 Adjuntando roomId para sticky session: ${roomIdForRouting}`);
      connectionOptions.query = { roomId: roomIdForRouting };
    }

    this.socket = io(this.serverUrl, connectionOptions);

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

      // Verificar errores específicos de conectividad
      if (error.message.includes("websocket error") ||
        error.message.includes("server with the specified hostname could not be found") ||
        error.message.includes("getaddrinfo ENOTFOUND")) {

        console.warn(`🌐 Servidor no disponible: ${this.serverUrl}`);
        this.showConnectionStatus(`Reconectando...`, "info");

        // Si no estamos en modo desarrollo, mostrar mensaje informativo
        if (!this.isDevelopmentMode()) {
          this.showNotification(
            `🔗 No se puede conectar al servidor. Verifica tu conexión a internet o intenta más tarde.`,
            "warning"
          );
        }
      }

      this.tryNextServer();
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.warn(`🔌 Desconectado de ${this.serverUrl}. Razón: ${reason}`);

      if (reason === "io server disconnect" || reason === "transport close" || reason === "transport error" || reason === "ping timeout") {
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
   * Verifica si estamos en modo desarrollo
   */
  isDevelopmentMode() {
    return import.meta.env.MODE === 'development' ||
      (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"));
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



    if (this.connectionAttempts % this.maxConnectionAttempts === 0) {
      // Intentar siguiente servidor
      this.currentServerIndex =
        (this.currentServerIndex + 1) % this.serverUrls.length;

      console.log(
        `🔄 Failover al servidor ${this.currentServerIndex + 1}: ${this.serverUrls[this.currentServerIndex]
        }`
      );
    }

    // Reconectar después de un delay
    // Si estamos en los primeros intentos (probando cada servidor una vez), hacerlo rápido
    const delay = this.connectionAttempts <= this.serverUrls.length ? 100 : 2000;

    setTimeout(() => {
      this.failoverInProgress = false;
      this.connectToServer();
    }, delay);
  }

  /**
   * Calcular servidor óptimo por roomId para sticky routing
   */
  // getServerForRoomId removed (legacy hash logic)


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
      this.updateCollaborationPanel();

      // Inicializar EditorSynchronizer una vez que el socket esté conectado
      // Inicializar EditorSynchronizer una vez que el socket esté conectado
      if (!this.editorSynchronizer) {
        this.initializeEditorSynchronizer();
      } else {
        // ACTUALIZACIÓN CRÍTICA: Actualizar el socket del synchronizer tras reconexión/failover
        console.log("🔄 Actualizando socket en EditorSynchronizer");
        this.editorSynchronizer.initializeSocket(this.socket);
      }

      setTimeout(() => {
        if (this.isConnected) {
          // Si teníamos una sala activa, intentar reconectar
          if (this.currentRoom) {
            console.log(`🔄 Intentando reconectar a sala previa: ${this.currentRoom}`);
            this.showNotification("Reconectando a la sala...", "info");

            // Usar join directo para evitar loops de redirección
            this._joinRoomDirect({
              roomId: this.currentRoom,
              userName: this.userName,
              password: null // No guardamos el password, asumir sesión válida o pedirá luego
            });
          }

          this.socket.emit("get-rooms");
        }
      }, 500);
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;

      // Mostrar estado azul (info) en lugar de error rojo si es desconexión temporal
      this.showConnectionStatus("Reconectando...", "info");
      this.updateCollaborationPanel();

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
      this.pendingRoomId = null; // Clear pending room after successful join
      this.showNotification(`Te uniste a la sala "${data.roomId}"`, "success");
      this.updateCollaborationPanel();

      if (this.editorSynchronizer) {
        this.editorSynchronizer.setHostStatus(this.isHost);
      }
    });

    this.socket.on("join-room-failed", (data) => {
      this.pendingRoomId = null; // Clear pending room on failure
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
      // console.log(`[Client] Received rooms-list event with ${rooms ? rooms.length : 0} rooms`);

      // Use the server list directly as it is the authoritative source containing global rooms
      this.updateAvailableRooms(rooms);
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

  /**
   * Obtiene la URL del servidor basada en la instancia (server-1, server-2)
   */
  getServerUrlForInstance(instanceId) {
    // Asumimos mapa ordenado por puerto si están en localhost
    if (instanceId === 'server-1') return this.serverUrls.find(url => url.includes('3001')) || this.serverUrls[0];
    if (instanceId === 'server-2') return this.serverUrls.find(url => url.includes('3002')) || this.serverUrls[1];
    return null;
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

    // REGLA 1: Si ambos están en el mismo puerto con la sala, no hagas cambio de servidor.
    console.log(`🏠 Creando sala ${roomId} en servidor actual: ${this.serverUrl}`);

    this._createRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Método interno para crear una sala directamente
   */
  _createRoomDirect({ roomId, password, userName }) {
    const editorData = this.editor.toJSON();
    console.log("[Manager] Creating room with editor data:", {
      keys: Object.keys(editorData),
      sceneChildren: editorData.scene?.object?.children?.length
    });

    // Crear payload inicial
    const payload = {
      roomId,
      userName,
      password,
      editor: editorData
    };
    this.socket.emit("create-room", payload);

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
        `Ya estás en la sala "${this.currentRoom}". ${action.charAt(0).toUpperCase() + action.slice(1)
        } la sala actual primero.`,
        "error"
      );
      return;
    }

    // Buscar información de la sala para ver dónde está alojada
    const roomInfo = this.unifiedRooms.find(r => r.id === roomId);
    let targetServerUrl = this.serverUrl; // Por defecto no cambiamos

    if (roomInfo && roomInfo.serverInstance) {
      // REGLA 2: Si el host y la sala están en otro servidor, migrar al usuario.
      const roomServerUrl = this.getServerUrlForInstance(roomInfo.serverInstance);

      if (roomServerUrl) {
        // REGLA 3: Evaluar disponibilidad (Rule 3 handled by latency check or failover fallback)
        if (roomServerUrl !== this.serverUrl) {
          const targetLatency = this.serverLatencies.get(roomInfo.serverInstance);
          if (targetLatency !== -1) {
            targetServerUrl = roomServerUrl;
            console.log(`🎯 Sala ${roomId} está en ${roomInfo.serverInstance}. Cambiando a ${targetServerUrl}`);
          } else {
            console.warn(`⚠️ Sala ${roomId} está en ${roomInfo.serverInstance} pero parece inalcanzable. Me quedo en ${this.serverUrl}`);
          }
        }
      }
    }

    if (targetServerUrl !== this.serverUrl) {
      const targetServerIndex = this.serverUrls.indexOf(targetServerUrl);
      if (targetServerIndex !== -1) {
        this.currentServerIndex = targetServerIndex;
        const rejoinData = { roomId, password, userName: this.userName };

        this.showNotification(`🔄 Conectando al servidor de la sala...`, "info");
        this.socket.disconnect();

        setTimeout(() => {
          this.connectToServer();
          const waitForConnection = () => {
            if (this.isConnected) {
              if (this.serverUrl === targetServerUrl) {
                this._joinRoomDirect(rejoinData);
              } else {
                // Fallback si el failover nos mandó a otro lado
                this._joinRoomDirect(rejoinData);
              }
            } else {
              setTimeout(waitForConnection, 500);
            }
          };
          setTimeout(waitForConnection, 1000);
        }, 500);
        return;
      }
    }

    // Unirse directamente si estamos en el servidor correcto
    this._joinRoomDirect({ roomId, password, userName: this.userName });
  }

  /**
   * Método interno para unirse a una sala directamente
   */
  _joinRoomDirect({ roomId, password, userName }) {
    // [CRITICAL FIX] Set pending room BEFORE reconnecting
    // This ensures sticky routing works when rejoining
    this.pendingRoomId = roomId;

    // Check if we need to reconnect with the new roomId
    const needsReconnect = !this.socket ||
      !this.socket.connected ||
      (this.socket.io.opts.query?.roomId !== roomId);

    if (needsReconnect) {
      console.log(`🔄 Reconectando con roomId para sticky routing: ${roomId}`);

      // Reconnect will use pendingRoomId in query params
      this.connectToServer();

      // Wait for connection AND synchronizer initialization before joining
      const waitForConnection = () => {
        if (this.isConnected && this.editorSynchronizer) {
          // Ensure synchronizer has the correct socket
          if (this.editorSynchronizer.socket !== this.socket) {
            console.log("🔄 Reinitializing EditorSynchronizer socket before join");
            this.editorSynchronizer.initializeSocket(this.socket);
          }

          this.socket.emit("join-room", {
            roomId: roomId,
            userName: userName,
            password: password,
          });
          this.showNotification(`Intentando unirse a la sala: ${roomId}...`, "info");
        } else {
          setTimeout(waitForConnection, 100);
        }
      };

      setTimeout(waitForConnection, 100);
    } else {
      // Already connected with correct roomId, just join
      this.socket.emit("join-room", {
        roomId: roomId,
        userName: userName,
        password: password,
      });
      this.showNotification(`Intentando unirse a la sala: ${roomId}...`, "info");
    }
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

      () => { }
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
      userCountElement.textContent = `👥 ${count} usuario${count === 1 ? "" : "s"
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

    // Actualizar UI
    try {
      // Enriquecer salas con información visual del servidor
      const enrichedRooms = rooms.map(room => {
        try {
          return {
            ...room,
            displayInfo: this.getRoomDisplayInfo(room)
          };
        } catch (err) {
          console.error('Error processing room:', room, err);
          return room;
        }
      });

      if (globalThis.collaborationPanel?.updateAvailableRooms) {
        globalThis.collaborationPanel.updateAvailableRooms(enrichedRooms);
      } else {
        console.warn('⚠️ CollaborationPanel no está disponible para actualizar salas');
      }

      // console.log('🏠 Salas actualizadas en UI:', enrichedRooms);

    } catch (error) {
      console.error('❌ Error actualizando panel de salas:', error);
    }
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



  /**
   * Verifica si el servidor actual es el host de la sala (para UI)
   */
  isOptimalServerForRoom(roomId) {
    const roomInfo = this.unifiedRooms.find(r => r.id === roomId);
    if (roomInfo && roomInfo.serverInstance) {
      return roomInfo.serverInstance === this.getCurrentServerInstance();
    }
    return true; // Si no sé, asumo que sí para no mostrar alertas raras
  }

  /**
   * Obtiene información de display para la sala
   */
  getRoomDisplayInfo(room) {
    if (!room) return '';
    const latency = this.serverLatencies.get(room.serverInstance);
    const latencyText = latency !== undefined ? `${latency}ms` : '--ms';
    const userCount = room.userCount || room.users || 0;

    let info = [];

    // 1. Green circle (Always connected/active)
    info.push('🟢');

    // 2. Latency
    info.push(latencyText);

    // 3. User Count
    info.push(`${userCount}👥`);

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
