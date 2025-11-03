/**
 * SyncSenders - Maneja el envío de actualizaciones al servidor
 */
class SyncSenders {
  constructor(editor, socket, collaborationManager, options = {}) {
    this.editor = editor;
    this.socket = socket;
    this.collaborationManager = collaborationManager;
    this.retryDelay = options.retryDelay || 5000;
  }

  /**
   * Serializa y envía el editor completo al servidor
   */
  sendFullEditor() {
    this.sendFullEditorWithRetry(0);
  }

  /**
   * Serializa y envía el editor con un reintento en caso de fallo
   */
  sendFullEditorWithRetry(retryCount = 0) {
    if (!this.collaborationManager.currentRoom) {
      return;
    }

    // Verificar conexión antes de enviar
    if (!this.socket || !this.socket.connected) {
      if (retryCount === 0) {
        setTimeout(() => {
          this.sendFullEditorWithRetry(1);
        }, this.retryDelay);
      } else {
        this.showNotification("No se pudo conectar al servidor", "error");
      }
      return;
    }

    try {
      const editorData = this.createCompleteEditorJSON();

      // Verificar tamaño de datos
      const dataSize = JSON.stringify(editorData).length;

      if (dataSize > 5000000) {
        // 5MB limit
        this.showNotification(
          "Editor demasiado grande para sincronizar",
          "warning"
        );
        return;
      }

      // Configurar timeout para la respuesta
      const syncTimeout = setTimeout(() => {
        if (retryCount === 0) {
          this.sendFullEditorWithRetry(1);
        } else {
          this.showNotification("Timeout al sincronizar editor", "error");
        }
      }, 30000); // 30 segundos timeout

      // Escuchar confirmación de sincronización
      const onSyncSuccess = () => {
        clearTimeout(syncTimeout);
        this.socket.off("sync-full-editor-success", onSyncSuccess);
        this.socket.off("sync-full-editor-error", onSyncError);
        this.showNotification("Editor sincronizado correctamente", "success");
      };

      const onSyncError = (error) => {
        clearTimeout(syncTimeout);
        this.socket.off("sync-full-editor-success", onSyncSuccess);
        this.socket.off("sync-full-editor-error", onSyncError);

        if (retryCount === 0) {
          setTimeout(() => {
            this.sendFullEditorWithRetry(1);
          }, this.retryDelay);
        } else {
          this.showNotification("Error al sincronizar editor", "error");
        }
      };

      this.socket.once("sync-full-editor-success", onSyncSuccess);
      this.socket.once("sync-full-editor-error", onSyncError);
      this.socket.emit("sync-full-editor", {
        roomId: this.collaborationManager.currentRoom,
        editorData: editorData,
      });
    } catch (error) {
      if (retryCount === 0) {
        setTimeout(() => {
          this.sendFullEditorWithRetry(1);
        }, this.retryDelay);
      } else {
        this.showNotification("Error al sincronizar editor", "error");
      }
    }
  }

  /**
   * Sincroniza la actualización de un objeto específico
   */
  syncObjectUpdate(object, changeType = "general") {
    if (!this.collaborationManager.currentRoom) return;

    if (!this.socket || !this.socket.connected) {
      return;
    }

    try {
      const objectData = object.toJSON();

      // Verificar tamaño del objeto
      const dataSize = JSON.stringify(objectData).length;
      if (dataSize > 1000000) {
        // 1MB limit
        return;
      }

      this.socket.emit("sync-editor-object-update", {
        roomId: this.collaborationManager.currentRoom,
        objectData: objectData,
        objectUuid: object.uuid,
        changeType: changeType,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing object update:", error);
    }
  }

  /**
   * Sincroniza la actualización de un material específico
   */
  syncMaterialUpdate(material, objectMaterialMap) {
    if (!this.collaborationManager.currentRoom) return;

    try {
      const objectsUsingMaterial = this.findObjectsUsingMaterial(
        material,
        objectMaterialMap
      );

      if (objectsUsingMaterial.length === 0) {
        this.sendFullEditor();
        return;
      }

      objectsUsingMaterial.forEach((objectInfo) => {
        const object = this.editor.scene.getObjectByProperty(
          "uuid",
          objectInfo.objectUuid,
          true
        );
        if (object) {
          this.syncObjectUpdate(object, "material-change");
        }
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing material update:", error);
    }
  }

  /**
   * Sincroniza la actualización de una geometría específica
   */
  syncGeometryUpdate(geometry, objectGeometryMap) {
    if (!this.collaborationManager.currentRoom) return;

    try {
      const objectsUsingGeometry = this.findObjectsUsingGeometry(
        geometry,
        objectGeometryMap
      );

      if (objectsUsingGeometry.length === 0) {
        this.sendFullEditor();
        return;
      }

      objectsUsingGeometry.forEach((objectInfo) => {
        const object = this.editor.scene.getObjectByProperty(
          "uuid",
          objectInfo.objectUuid,
          true
        );
        if (object) {
          this.syncObjectUpdate(object, "geometry-change");
        }
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing geometry update:", error);
    }
  }

  /**
   * Sincroniza cuando se agrega un script
   */
  syncScriptAdded(script) {
    if (!this.collaborationManager.currentRoom) return;

    try {
      const objectUuid = this.findObjectUuidForScript(script);
      if (!objectUuid) return;

      this.socket.emit("sync-script-added", {
        roomId: this.collaborationManager.currentRoom,
        objectUuid: objectUuid,
        script: script,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing script added:", error);
    }
  }

  /**
   * Sincroniza cuando se cambia un script
   */
  syncScriptChanged(script) {
    if (!this.collaborationManager.currentRoom) return;

    try {
      const objectUuid = this.findObjectUuidForScript(script);
      if (!objectUuid) return;

      this.socket.emit("sync-script-changed", {
        roomId: this.collaborationManager.currentRoom,
        objectUuid: objectUuid,
        script: script,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing script changed:", error);
    }
  }

  /**
   * Sincroniza cuando se elimina un script
   */
  syncScriptRemoved(script) {
    if (!this.collaborationManager.currentRoom) return;

    try {
      const objectUuid = this.findObjectUuidForScript(script);
      if (!objectUuid) return;

      this.socket.emit("sync-script-removed", {
        roomId: this.collaborationManager.currentRoom,
        objectUuid: objectUuid,
        script: script,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing script removed:", error);
    }
  }

  /**
   * Sincroniza la eliminación de un objeto específico
   */
  syncObjectRemoval(object) {
    if (!this.collaborationManager.currentRoom) {
      return;
    }

    if (!object || !object.uuid) {
      return;
    }

    try {
      const removalData = {
        roomId: this.collaborationManager.currentRoom,
        objectId: object.uuid,
        objectType: object.type,
        objectName: object.name || "Unnamed",
        timestamp: Date.now()
      };
      this.socket.emit("sync-editor-object-removal", removalData);
    } catch (error) {
      this.collaborationManager?.showNotification?.("Error al sincronizar eliminación", "error");
    }
  }

  /**
   * Sincroniza cambio de background de la escena
   */
  syncSceneBackgroundUpdate() {
    if (!this.collaborationManager.currentRoom) return;

    try {
      let backgroundData = null;

      if (this.editor.scene.background) {
        if (this.editor.scene.background.isColor) {
          backgroundData = {
            type: "Color",
            r: this.editor.scene.background.r,
            g: this.editor.scene.background.g,
            b: this.editor.scene.background.b,
          };
        }
      }

      this.socket.emit("sync-scene-background-update", {
        roomId: this.collaborationManager.currentRoom,
        backgroundData: backgroundData,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing scene background:", error);
    }
  }

  /**
   * Sincroniza cambio de fog de la escena
   */
  syncSceneFogUpdate() {
    if (!this.collaborationManager.currentRoom) return;

    try {
      let fogData = null;
      if (this.editor.scene.fog) {
        fogData = {
          type:
            this.editor.scene.fog.type ||
            this.editor.scene.fog.constructor.name,
          color: {
            r: this.editor.scene.fog.color.r,
            g: this.editor.scene.fog.color.g,
            b: this.editor.scene.fog.color.b,
          },
        };

        if (this.editor.scene.fog.isFog) {
          fogData.near = this.editor.scene.fog.near;
          fogData.far = this.editor.scene.fog.far;
        } else if (this.editor.scene.fog.isFogExp2) {
          fogData.density = this.editor.scene.fog.density;
        }
      }

      this.socket.emit("sync-scene-fog-update", {
        roomId: this.collaborationManager.currentRoom,
        fogData: fogData,
      });
    } catch (error) {
      console.error("[SyncSenders] Error syncing scene fog:", error);
    }
  }

  /**
   * Encuentra objetos que usan un material específico
   */
  findObjectsUsingMaterial(material, objectMaterialMap) {
    const objectsUsingMaterial = [];

    // Estrategia 1: Buscar por referencia directa
    this.editor.scene.traverse((object) => {
      if (object.material) {
        if (Array.isArray(object.material)) {
          const materialIndex = object.material.indexOf(material);
          if (materialIndex !== -1) {
            objectsUsingMaterial.push({
              objectUuid: object.uuid,
              objectName: object.name,
              objectType: object.type,
              materialSlot: materialIndex,
            });
          }
        } else if (object.material === material) {
          objectsUsingMaterial.push({
            objectUuid: object.uuid,
            objectName: object.name,
            objectType: object.type,
            materialSlot: 0,
          });
        }
      }
    });

    // Estrategia 2: Buscar por UUID en el mapa
    if (objectsUsingMaterial.length === 0 && objectMaterialMap) {
      this.editor.scene.traverse((object) => {
        if (object.material) {
          const mappedUUIDs = objectMaterialMap.get(object.id);
          if (mappedUUIDs) {
            if (Array.isArray(mappedUUIDs)) {
              const slotIndex = mappedUUIDs.indexOf(material.uuid);
              if (slotIndex !== -1) {
                objectsUsingMaterial.push({
                  objectUuid: object.uuid,
                  objectName: object.name,
                  objectType: object.type,
                  materialSlot: slotIndex,
                });
              }
            } else if (mappedUUIDs === material.uuid) {
              objectsUsingMaterial.push({
                objectUuid: object.uuid,
                objectName: object.name,
                objectType: object.type,
                materialSlot: 0,
              });
            }
          }
        }
      });
    }

    // Estrategia 3: Buscar el objeto seleccionado
    if (objectsUsingMaterial.length === 0) {
      const selectedObject = this.editor.selected;
      if (selectedObject && selectedObject.material) {
        objectsUsingMaterial.push({
          objectUuid: selectedObject.uuid,
          objectName: selectedObject.name,
          objectType: selectedObject.type,
          materialSlot: 0,
        });
      }
    }

    return objectsUsingMaterial;
  }

  /**
   * Encuentra objetos que usan una geometría específica
   */
  findObjectsUsingGeometry(geometry, objectGeometryMap) {
    const objectsUsingGeometry = [];

    // Estrategia 1: Buscar por referencia directa
    this.editor.scene.traverse((object) => {
      if (object.geometry === geometry) {
        objectsUsingGeometry.push({
          objectUuid: object.uuid,
          objectName: object.name,
          objectType: object.type,
        });
      }
    });

    // Estrategia 2: Buscar por UUID en el mapa
    if (objectsUsingGeometry.length === 0 && objectGeometryMap) {
      this.editor.scene.traverse((object) => {
        if (object.geometry) {
          const mappedUUID = objectGeometryMap.get(object.id);
          if (mappedUUID === geometry.uuid) {
            objectsUsingGeometry.push({
              objectUuid: object.uuid,
              objectName: object.name,
              objectType: object.type,
            });
          }
        }
      });
    }

    // Estrategia 3: Buscar el objeto seleccionado
    if (objectsUsingGeometry.length === 0) {
      const selectedObject = this.editor.selected;
      if (selectedObject && selectedObject.geometry) {
        objectsUsingGeometry.push({
          objectUuid: selectedObject.uuid,
          objectName: selectedObject.name,
          objectType: selectedObject.type,
        });
      }
    }

    return objectsUsingGeometry;
  }

  /**
   * Encuentra el UUID del objeto que contiene un script
   */
  findObjectUuidForScript(script) {
    for (const uuid in this.editor.scripts) {
      const scripts = this.editor.scripts[uuid];
      if (scripts && scripts.includes(script)) {
        return uuid;
      }
    }
    return null;
  }

  /**
   * Crea un JSON completo del editor asegurando estructura válida
   */
  createCompleteEditorJSON() {
    const editorData = this.editor.toJSON();

    // Validar y completar la estructura si falta algo
    if (!editorData.camera && this.editor.camera) {
      editorData.camera = this.editor.camera.toJSON();
    }

    if (!editorData.scene && this.editor.scene) {
      editorData.scene = this.editor.scene.toJSON();
    }

    if (!editorData.object && this.editor.scene) {
      editorData.object = this.editor.scene.toJSON();
    }

    // Validar estructura mínima
    if (!editorData.object) {
      editorData.object = {
        type: "Scene",
        children: [],
      };
    }

    // Asegurar que los scripts estén incluidos correctamente
    if (this.editor.scripts && Object.keys(this.editor.scripts).length > 0) {
      if (!editorData.scripts) {
        editorData.scripts = this.editor.scripts;
      }
    } else {
      editorData.scripts = {};
    }

    // Solo agregar geometrías y materiales si no están ya incluidos
    if (
      !editorData.geometries ||
      Object.keys(editorData.geometries).length === 0
    ) {
      editorData.geometries = this.collectGeometries();
    }

    if (
      !editorData.materials ||
      Object.keys(editorData.materials).length === 0
    ) {
      editorData.materials = this.collectMaterials();
    }

    return editorData;
  }

  /**
   * Recolecta todas las geometrías únicas en la escena
   */
  collectGeometries() {
    const geometries = {};
    const geometryUUIDs = new Set();

    this.editor.scene.traverse((object) => {
      if (object.geometry && !geometryUUIDs.has(object.geometry.uuid)) {
        geometryUUIDs.add(object.geometry.uuid);
        geometries[object.geometry.uuid] = object.geometry.toJSON();
      }
    });

    return geometries;
  }

  /**
   * Recolecta todos los materiales únicos en la escena
   */
  collectMaterials() {
    const materials = {};
    const materialUUIDs = new Set();

    this.editor.scene.traverse((object) => {
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (!materialUUIDs.has(material.uuid)) {
              materialUUIDs.add(material.uuid);
              materials[material.uuid] = material.toJSON();
            }
          });
        } else {
          if (!materialUUIDs.has(object.material.uuid)) {
            materialUUIDs.add(object.material.uuid);
            materials[object.material.uuid] = object.material.toJSON();
          }
        }
      }
    });

    return materials;
  }

  /**
   * Muestra notificación
   */
  showNotification(message, type) {
    this.collaborationManager?.showNotification?.(message, type);
  }
}

export { SyncSenders };
