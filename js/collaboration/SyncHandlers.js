/**
 * SyncHandlers - Maneja la recepción de actualizaciones del servidor
 */
class SyncHandlers {
  constructor(editor, socket, collaborationManager, options = {}) {
    this.editor = editor;
    this.socket = socket;
    this.collaborationManager = collaborationManager;
    this.isSyncing = false;
    this.currentEditorVersion = -1;
    this.throttledInterfaceUpdate = options.throttledInterfaceUpdate;
  }

  /**
   * Maneja recepción de editor completo
   */
  async handleReceiveFullEditor(data, hasSceneContent, sendFullEditor) {
    // Validación para sala vacía
    if (
      data.version === 0 &&
      data.hostId === null &&
      data.isInitialSync &&
      !data.editorData
    ) {
      if (hasSceneContent()) {
        setTimeout(() => {
          sendFullEditor();
        }, 1000);
      }
      return;
    }

    // Validación básica de datos
    if (!data || !data.editorData) {
      console.error("[Sync] Received invalid editor data:", data);
      this.showNotification("Error: datos de editor inválidos", "error");
      return;
    }

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    // Evitar aplicar versiones repetidas
    if (
      typeof data.version === "number" &&
      data.version <= this.currentEditorVersion
    ) {
      return;
    }

    this.isSyncing = true;
    this.currentEditorVersion = data.version;

    try {
      await this.applyFullEditor(data.editorData);
      if (data.isInitialSync) {
        this.showNotification("Contenido de la sala cargado", "info");
      } else {
        this.showNotification("Editor actualizado por colaborador", "info");
      }
    } catch (error) {
      this.showNotification("Error al aplicar el editor", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja actualización de objeto individual
   */
  handleReceiveObjectUpdate(data, updateUUIDMapsRecursively) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      const existingObject = this.editor.scene.getObjectByProperty(
        "uuid",
        data.objectUuid,
        true
      );

      if (existingObject) {
        this.updateExistingObject(existingObject, data);
      } else {
        this.createNewObject(data, updateUUIDMapsRecursively);
      }
    } catch (error) {
      this.showNotification("Error al actualizar objeto", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Actualiza un objeto existente
   */
  updateExistingObject(existingObject, data) {
    const loader = new THREE.ObjectLoader();
    const updatedObject = loader.parse(data.objectData);

    // Preservar UUIDs originales
    const originalUuid = existingObject.uuid;
    const originalGeometryUuid = existingObject.geometry
      ? existingObject.geometry.uuid
      : null;
    const originalMaterialUUIDs = existingObject.material
      ? Array.isArray(existingObject.material)
        ? existingObject.material.map((m) => m.uuid)
        : existingObject.material.uuid
      : null;

    // Verificar si hay cambios reales
    let hasRealChanges = false;

    if (
      data.changeType === "geometry-change" ||
      data.changeType === "material-change"
    ) {
      hasRealChanges = true;
    } else {
      hasRealChanges = this.objectHasChanges(existingObject, updatedObject);
    }

    if (!hasRealChanges) {
      return;
    }

    // Copiar propiedades
    existingObject.copy(updatedObject, false);

    // Copiar propiedades dinámicas
    for (const prop in updatedObject) {
      if (prop.startsWith("_") || typeof updatedObject[prop] === "function") {
        continue;
      }

      const skipProps = [
        "geometry",
        "material",
        "children",
        "parent",
        "uuid",
        "id",
      ];
      if (skipProps.includes(prop)) {
        continue;
      }

      try {
        if (
          typeof updatedObject[prop] === "object" &&
          updatedObject[prop] !== null
        ) {
          if (
            updatedObject[prop].constructor === Object ||
            Array.isArray(updatedObject[prop])
          ) {
            existingObject[prop] = JSON.parse(
              JSON.stringify(updatedObject[prop])
            );
          } else {
            existingObject[prop] = updatedObject[prop];
          }
        } else {
          existingObject[prop] = updatedObject[prop];
        }
      } catch (e) {
        // Continuar si falla
      }
    }

    // Restaurar UUIDs
    existingObject.uuid = originalUuid;

    if (data.changeType !== "geometry-change") {
      if (originalGeometryUuid && existingObject.geometry) {
        existingObject.geometry.uuid = originalGeometryUuid;
      }
    }

    if (data.changeType !== "material-change") {
      if (originalMaterialUUIDs && existingObject.material) {
        if (
          Array.isArray(existingObject.material) &&
          Array.isArray(originalMaterialUUIDs)
        ) {
          existingObject.material.forEach((material, index) => {
            if (index < originalMaterialUUIDs.length) {
              material.uuid = originalMaterialUUIDs[index];
            }
          });
        } else if (
          !Array.isArray(existingObject.material) &&
          !Array.isArray(originalMaterialUUIDs)
        ) {
          existingObject.material.uuid = originalMaterialUUIDs;
        }
      }
    }

    // Disparar señales
    this.editor.signals.objectChanged.dispatch(existingObject);

    if (data.changeType === "geometry-change") {
      this.editor.signals.geometryChanged.dispatch(existingObject);
    } else if (data.changeType === "material-change") {
      this.editor.signals.materialChanged.dispatch(existingObject);
    }

    // Actualizar interfaz
    if (this.editor.selected === existingObject) {
      this.throttledInterfaceUpdate?.(existingObject);
    }

    this.editor.signals.sceneGraphChanged.dispatch();
  }

  /**
   * Crea un nuevo objeto
   */
  createNewObject(data, updateUUIDMapsRecursively) {
    if (
      data.changeType === "object-added" ||
      data.changeType === "imported-object" ||
      data.changeType === "force-sync"
    ) {
      const loader = new THREE.ObjectLoader();
      const newObject = loader.parse(data.objectData);

      this.editor.addObject(newObject);
      updateUUIDMapsRecursively(newObject);

      if (data.changeType === "imported-object") {
        this.showNotification("Objeto importado sincronizado", "info");
      } else if (data.changeType === "force-sync") {
        this.showNotification("Objeto sincronizado", "info");
      } else {
        this.showNotification("Nuevo objeto añadido", "info");
      }
    } else {
      // Solicitar sincronización completa
      this.socket.emit("request-editor-sync", {
        roomId: this.collaborationManager.currentRoom,
      });
    }
  }

  /**
   * Maneja eliminación de objeto
   */
  handleReceiveObjectRemoval(data) {
    if (this.isSyncing) return;

    // Validar datos de entrada
    if (!data || !data.objectId) {
      return;
    }

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      const objectToRemove = this.editor.scene.getObjectByProperty(
        "uuid",
        data.objectId,
        true
      );

      if (objectToRemove) {
        // Verificar si el objeto a eliminar es el actualmente seleccionado
        const wasSelected = this.editor.selected === objectToRemove;

        // Si es el objeto seleccionado, deseleccionar primero
        if (wasSelected) {
          this.editor.select(null);
        }

        // Eliminar el objeto
        this.editor.removeObject(objectToRemove);
        this.showNotification("Objeto eliminado por colaborador", "info");
      }
    } catch (error) {
      this.showNotification(
        "Error al eliminar objeto: " + error.message,
        "error"
      );
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja actualización de background de escena
   */
  handleReceiveSceneBackgroundUpdate(data) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      if (data.backgroundData) {
        if (data.backgroundData.type === "Color") {
          this.editor.scene.background = new THREE.Color(
            data.backgroundData.r,
            data.backgroundData.g,
            data.backgroundData.b
          );
        } else if (
          data.backgroundData.type === "Texture" &&
          data.backgroundData.data
        ) {
          const loader = new THREE.ObjectLoader();
          const textures = loader.parseTextures([data.backgroundData.data]);
          this.editor.scene.background =
            textures[data.backgroundData.data.uuid];
        }
      } else {
        this.editor.scene.background = null;
      }

      this.editor.signals.sceneGraphChanged.dispatch();
    } catch (error) {
      this.showNotification("Error al actualizar background", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja actualización de fog de escena
   */
  handleReceiveSceneFogUpdate(data) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      if (data.fogData) {
        const color = new THREE.Color(
          data.fogData.color.r,
          data.fogData.color.g,
          data.fogData.color.b
        );

        if (data.fogData.type === "Fog" || data.fogData.near !== undefined) {
          this.editor.scene.fog = new THREE.Fog(
            color,
            data.fogData.near,
            data.fogData.far
          );
        } else if (
          data.fogData.type === "FogExp2" ||
          data.fogData.density !== undefined
        ) {
          this.editor.scene.fog = new THREE.FogExp2(
            color,
            data.fogData.density
          );
        }
      } else {
        this.editor.scene.fog = null;
      }

      this.editor.signals.sceneGraphChanged.dispatch();
      this.showNotification("Fog actualizado", "info");
    } catch (error) {
      this.showNotification("Error al actualizar fog", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja cuando se recibe un script agregado
   */
  handleReceiveScriptAdded(data) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      const object = this.editor.scene.getObjectByProperty(
        "uuid",
        data.objectUuid,
        true
      );

      if (object) {
        this.editor.addScript(object, data.script);
        this.showNotification("Script agregado", "info");
      }
    } catch (error) {
      this.showNotification("Error al agregar script", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja cuando se recibe un script modificado
   */
  handleReceiveScriptChanged(data) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      const object = this.editor.scene.getObjectByProperty(
        "uuid",
        data.objectUuid,
        true
      );

      if (object && this.editor.scripts[object.uuid]) {
        const scripts = this.editor.scripts[object.uuid];
        const existingScript = scripts.find((s) => s.uuid === data.script.uuid);

        if (existingScript) {
          Object.assign(existingScript, data.script);
          this.editor.signals.scriptChanged.dispatch(existingScript);
          this.showNotification("Script actualizado", "info");
        }
      }
    } catch (error) {
      this.showNotification("Error al actualizar script", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Maneja cuando se recibe un script eliminado
   */
  handleReceiveScriptRemoved(data) {
    if (this.isSyncing) return;

    if (
      data.originUserId &&
      this.collaborationManager.socket.id === data.originUserId
    ) {
      return;
    }

    this.isSyncing = true;

    try {
      const object = this.editor.scene.getObjectByProperty(
        "uuid",
        data.objectUuid,
        true
      );

      if (object && this.editor.scripts[object.uuid]) {
        const scripts = this.editor.scripts[object.uuid];
        const scriptToRemove = scripts.find((s) => s.uuid === data.script.uuid);

        if (scriptToRemove) {
          this.editor.removeScript(object, scriptToRemove);
          this.showNotification("Script eliminado", "info");
        }
      }
    } catch (error) {
      this.showNotification("Error al eliminar script", "error");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Aplica editor completo usando Editor.fromJSON()
   */
  async applyFullEditor(editorData) {
    const autoSyncEnabled = this.editor.autoSyncEnabled;
    this.editor.autoSyncEnabled = false;

    console.log("[Sync] Applying full editor data:", {
      hasScene: !!editorData?.scene,
      hasCamera: !!editorData?.camera,
      keys: editorData ? Object.keys(editorData) : 'null'
    });

    try {
      if (!editorData) {
        throw new Error("No editor data provided");
      }

      // Ensure scene exists (critical for fromJSON)
      if (!editorData.scene) {
        console.warn("[Sync] editorData.scene missing, using current scene as fallback");
        editorData.scene = this.editor.scene.toJSON();
      }

      // Ensure camera exists
      if (!editorData.camera) {
        console.warn("[Sync] editorData.camera missing, using current camera as fallback");
        const currentCamera = this.editor.camera;
        editorData.camera = currentCamera.toJSON();
      }

      // Clean orphaned scripts
      this.cleanOrphanedScripts(editorData);

      // Ensure scripts check
      if (editorData.scripts === undefined || editorData.scripts === null) {
        editorData.scripts = {};
      }

      // Execute load
      await this.editor.fromJSON(editorData);

      this.editor.signals.sceneGraphChanged.dispatch();
    } catch (error) {
      console.error("[Sync] Error in applyFullEditor:", error);
      throw error;
    } finally {
      this.editor.autoSyncEnabled = autoSyncEnabled;
    }
  }

  /**
   * Verifica si un objeto tiene cambios reales
   */
  objectHasChanges(existingObject, updatedObject) {
    try {
      // Comparar transformaciones
      if (!existingObject.position.equals(updatedObject.position)) return true;
      if (!existingObject.rotation.equals(updatedObject.rotation)) return true;
      if (!existingObject.scale.equals(updatedObject.scale)) return true;

      // Comparar propiedades dinámicas
      for (const prop in updatedObject) {
        if (prop.startsWith("_") || typeof updatedObject[prop] === "function") {
          continue;
        }

        const skipProps = [
          "position",
          "rotation",
          "scale",
          "geometry",
          "material",
          "children",
          "parent",
          "uuid",
          "id",
          "matrix",
          "matrixWorld",
        ];
        if (skipProps.includes(prop)) {
          continue;
        }

        const existingValue = existingObject[prop];
        const updatedValue = updatedObject[prop];

        // Comparar primitivos
        if (
          typeof updatedValue === "boolean" ||
          typeof updatedValue === "string" ||
          typeof updatedValue === "number"
        ) {
          if (existingValue !== updatedValue) {
            return true;
          }
        }

        // Comparar objetos
        if (typeof updatedValue === "object" && updatedValue !== null) {
          if (
            prop === "layers" &&
            existingValue &&
            existingValue.mask !== undefined
          ) {
            if (existingValue.mask !== updatedValue.mask) {
              return true;
            }
          } else if (
            updatedValue.constructor === Object ||
            Array.isArray(updatedValue)
          ) {
            try {
              if (
                JSON.stringify(existingValue) !== JSON.stringify(updatedValue)
              ) {
                return true;
              }
            } catch (e) {
              return true;
            }
          }
        }
      }

      // Comparar UUIDs
      if (existingObject.material && updatedObject.material) {
        if (existingObject.material.uuid !== updatedObject.material.uuid)
          return true;
      }

      if (existingObject.geometry && updatedObject.geometry) {
        if (existingObject.geometry.uuid !== updatedObject.geometry.uuid)
          return true;
      }

      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Limpia scripts huérfanos
   */
  cleanOrphanedScripts(editorData) {
    try {
      if (!editorData.scripts) {
        editorData.scripts = {};
        return;
      }

      if (Object.keys(editorData.scripts).length === 0) {
        return;
      }

      const validScriptUUIDs = new Set(Object.keys(editorData.scripts));
      let cleanedCount = 0;

      const objectUUIDs = new Set();
      const collectObjectUUIDs = (object) => {
        if (object.uuid) {
          objectUUIDs.add(object.uuid);
        }
        if (object.children) {
          object.children.forEach(collectObjectUUIDs);
        }
      };

      if (editorData.object) {
        collectObjectUUIDs(editorData.object);
      }

      const scriptsToRemove = [];
      for (const scriptUUID in editorData.scripts) {
        if (!objectUUIDs.has(scriptUUID)) {
          scriptsToRemove.push(scriptUUID);
          cleanedCount++;
        }
      }

      scriptsToRemove.forEach((uuid) => {
        delete editorData.scripts[uuid];
      });
    } catch (error) {
      if (editorData && editorData.scripts) {
        editorData.scripts = {};
      }
    }
  }

  /**
   * Muestra notificación
   */
  showNotification(message, type) {
    this.collaborationManager?.showNotification?.(message, type);
  }
}

export { SyncHandlers };
