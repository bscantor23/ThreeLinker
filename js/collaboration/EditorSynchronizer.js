import { SyncSenders } from "./SyncSenders.js";
import { SyncHandlers } from "./SyncHandlers.js";
import { UUIDPreservation } from "./UUIDPreservation.js";

/**
 * EditorSynchronizer - Clase principal para sincronización de editor en colaboración
 */
class EditorSynchronizer {
  constructor(editor, socket, collaborationManager) {
    this.editor = editor;
    this.socket = socket;
    this.collaborationManager = collaborationManager;
    this.isHost = false;
    this.syncDelay = 500;
    this.syncTimeout = null;
    this.retryDelay = 5000;

    // Throttle para actualizaciones de interfaz
    this.throttledInterfaceUpdate = this.throttle(
      this.updateSelectedObjectInterface.bind(this),
      100
    );

    // Inicializar módulos especializados
    this.senders = new SyncSenders(editor, socket, collaborationManager, {
      retryDelay: this.retryDelay,
    });

    this.handlers = new SyncHandlers(editor, socket, collaborationManager, {
      throttledInterfaceUpdate: this.throttledInterfaceUpdate,
    });

    this.uuidPreservation = new UUIDPreservation(editor);

    this.setupEventHandlers();
    this.setupEditorSignalListeners();
  }

  /**
   * Getter/Setter para isSyncing (delega al handlers)
   */
  get isSyncing() {
    return this.handlers.isSyncing;
  }

  set isSyncing(value) {
    this.handlers.isSyncing = value;
  }

  /**
   * Getter/Setter para autoSyncEnabled
   */
  get autoSyncEnabled() {
    return this.editor.autoSyncEnabled !== false;
  }

  set autoSyncEnabled(value) {
    this.editor.autoSyncEnabled = value;
  }

  /**
   * Configura el socket cuando esté disponible
   */
  initializeSocket(socket) {
    this.socket = socket;
    this.senders.socket = socket;
    this.handlers.socket = socket;
    this.setupEventHandlers();
  }

  /**
   * Configura los event handlers del socket
   */
  setupEventHandlers() {
    if (!this.socket || typeof this.socket.on !== "function") {
      return;
    }

    // Recepción de editor completo
    this.socket.on("receive-full-editor", (data) => {
      this.handlers.handleReceiveFullEditor(
        data,
        this.hasSceneContent.bind(this),
        this.sendFullEditorToServer.bind(this)
      );
    });

    // Recepción de actualizaciones de objetos
    this.socket.on("receive-editor-object-update", (data) => {
      this.handlers.handleReceiveObjectUpdate(
        data,
        this.uuidPreservation.updateUUIDMapsRecursively.bind(
          this.uuidPreservation
        )
      );
    });

    // Recepción de eliminación de objetos
    this.socket.on("receive-editor-object-removal", (data) => {
      this.handlers.handleReceiveObjectRemoval(data);
    });

    // Recepción de cambios en propiedades de escena
    this.socket.on("receive-scene-background-update", (data) => {
      this.handlers.handleReceiveSceneBackgroundUpdate(data);
    });

    this.socket.on("receive-scene-fog-update", (data) => {
      this.handlers.handleReceiveSceneFogUpdate(data);
    });

    // Recepción de cambios en scripts
    this.socket.on("receive-script-added", (data) => {
      this.handlers.handleReceiveScriptAdded(data);
    });

    this.socket.on("receive-script-changed", (data) => {
      this.handlers.handleReceiveScriptChanged(data);
    });

    this.socket.on("receive-script-removed", (data) => {
      this.handlers.handleReceiveScriptRemoved(data);
    });

    // Manejo de errores
    this.socket.on("editor-sync-error", (data) => {
      this.showNotification("Error de sincronización", "error");
    });

    // Manejo de sincronización pendiente
    this.socket.on("editor-sync-pending", (data) => {
      this.showNotification("Sincronizando editor...", "info");
    });
  }

  /**
   * Configura listeners para cambios automáticos del Editor
   */
  setupEditorSignalListeners() {
    // Escuchar cambios en objetos
    this.editor.signals.objectChanged.add((object) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncObjectUpdate(object);
    });

    this.editor.signals.objectAdded.add((object) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncObjectUpdate(object, "object-added");
    });

    this.editor.signals.objectRemoved.add((object) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncObjectRemoval(object);
    });

    // Escuchar cambios en propiedades de escena
    this.editor.signals.sceneBackgroundChanged.add(() => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncSceneBackgroundUpdate();
    });

    this.editor.signals.sceneFogChanged.add(() => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncSceneFogUpdate();
    });

    // Escuchar cambios en materiales y geometrías
    this.editor.signals.materialChanged.add((material) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncMaterialUpdate(
        material,
        this.uuidPreservation.objectMaterialMap
      );
    });

    this.editor.signals.geometryChanged.add((geometry) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncGeometryUpdate(
        geometry,
        this.uuidPreservation.objectGeometryMap
      );
    });

    // Escuchar cambios en scripts
    this.editor.signals.scriptAdded.add((script) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncScriptAdded(script);
    });

    this.editor.signals.scriptChanged.add((script) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncScriptChanged(script);
    });

    this.editor.signals.scriptRemoved.add((script) => {
      if (this.isSyncing || !this.autoSyncEnabled) return;
      this.senders.syncScriptRemoved(script);
    });
  }

  /**
   * Activa modo host o invitado
   */
  setMode(isHost) {
    this.isHost = isHost;
    if (isHost) {
      this.setupHostMode();
    } else {
      this.setupGuestMode();
    }
  }

  /**
   * Método de compatibilidad para setHostStatus
   */
  setHostStatus(isHost) {
    this.setMode(isHost);
  }

  /**
   * Configura modo host
   */
  setupHostMode() {
    setTimeout(() => {
      this.syncCurrentHostEditor();
    }, 500);
  }

  /**
   * Sincroniza el editor actual del host si tiene contenido
   */
  syncCurrentHostEditor() {
    if (!this.isHost || !this.collaborationManager.currentRoom) return;

    const scene = this.editor.scene;
    let hasContent = false;

    scene.traverse((object) => {
      if (
        object !== scene &&
        object.type !== "Camera" &&
        !object.userData.system
      ) {
        hasContent = true;
      }
    });

    if (scene.background || scene.environment || scene.fog) {
      hasContent = true;
    }

    if (hasContent) {
      this.sendFullEditorToServer();
    }
  }

  /**
   * Configura modo invitado
   */
  setupGuestMode() {
    setTimeout(() => {
      this.requestInitialSync();
    }, 1000);
  }

  /**
   * Solicita sincronización inicial desde el servidor
   */
  requestInitialSync() {
    if (!this.collaborationManager.currentRoom) return;
    this.socket.emit("request-editor-sync", {
      roomId: this.collaborationManager.currentRoom,
    });
  }

  /**
   * Envía el editor completo al servidor
   */
  sendFullEditorToServer() {
    this.senders.sendFullEditor();
  }

  /**
   * Verifica si la escena actual tiene contenido
   */
  hasSceneContent() {
    const scene = this.editor.scene;
    let hasContent = false;

    scene.traverse((object) => {
      if (
        object !== scene &&
        object.type !== "Camera" &&
        !object.userData.system
      ) {
        hasContent = true;
      }
    });

    return hasContent || scene.background || scene.environment || scene.fog;
  }

  /**
   * Throttled full sync para evitar demasiadas actualizaciones
   */
  throttledFullSync = this.throttle(() => {
    if (!this.isSyncing && this.collaborationManager.currentRoom) {
      this.sendFullEditorToServer();
    }
  }, 2000);

  /**
   * Utility function para throttling
   */
  throttle(func, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Actualiza la interfaz del objeto seleccionado sin reseleccionar
   */
  updateSelectedObjectInterface(object) {
    try {
      this.editor.signals.objectSelected.dispatch(object);

      if (this.editor.signals.refreshSidebarObject) {
        this.editor.signals.refreshSidebarObject.dispatch(object);
      }

      if (this.editor.transformControls) {
        this.editor.transformControls.attach(object);
      }
    } catch (error) {
      // Fallback: reseleccionar solo si hay error
      const selectedObject = this.editor.selected;
      this.editor.select(null);
      setTimeout(() => {
        this.editor.select(selectedObject);
      }, 10);
    }
  }

  /**
   * Muestra notificación
   */
  showNotification(message, type) {
    this.collaborationManager?.showNotification?.(message, type);
  }

  /**
   * Limpia el sincronizador
   */
  dispose() {
    if (this.socket) {
      this.socket.off("receive-full-editor");
      this.socket.off("receive-editor-object-update");
      this.socket.off("receive-editor-object-removal");
      this.socket.off("receive-scene-background-update");
      this.socket.off("receive-scene-fog-update");
      this.socket.off("receive-script-added");
      this.socket.off("receive-script-changed");
      this.socket.off("receive-script-removed");
      this.socket.off("editor-sync-error");
      this.socket.off("editor-sync-pending");
    }

    if (this.uuidPreservation) {
      this.uuidPreservation.dispose();
    }
  }
}

export { EditorSynchronizer };
