/**
 * EditorManager - Gestiona la sincronización de datos del Editor Three.js entre usuarios
 */
class EditorManager {
  constructor() {
    this.roomEditors = new Map(); // roomId -> editorData
    this.editorVersions = new Map(); // roomId -> version number
  }

  /**
   * Almacena los datos completos del Editor de una sala
   */
  setRoomEditor(roomId, editorData, hostId) {
    try {
      // Validar que el editorData sea válido
      if (!editorData || typeof editorData !== "object") {
        throw new Error("Editor data must be a valid object");
      }

      // Incrementar versión del editor
      const currentVersion = this.editorVersions.get(roomId) || 0;
      const newVersion = currentVersion + 1;

      const editorInfo = {
        data: editorData,
        hostId: hostId,
        lastUpdate: Date.now(),
        version: newVersion,
      };

      this.roomEditors.set(roomId, editorInfo);
      this.editorVersions.set(roomId, newVersion);

      return { success: true, version: newVersion };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene los datos completos del Editor de una sala
   */
  getRoomEditor(roomId) {
    const editorInfo = this.roomEditors.get(roomId);
    if (!editorInfo) {
      return { success: false, error: "No editor data found for this room" };
    }

    return {
      success: true,
      editorData: editorInfo.data,
      hostId: editorInfo.hostId,
      lastUpdate: editorInfo.lastUpdate,
      version: editorInfo.version,
    };
  }

  /**
   * Verifica si una sala tiene datos del Editor
   */
  hasRoomEditor(roomId) {
    return this.roomEditors.has(roomId);
  }

  /**
   * Obtiene la versión actual del Editor de una sala
   */
  getEditorVersion(roomId) {
    return this.editorVersions.get(roomId) || 0;
  }

  /**
   * Elimina los datos del Editor de una sala
   */
  deleteRoomEditor(roomId) {
    const deleted = this.roomEditors.delete(roomId);
    this.editorVersions.delete(roomId);
    return deleted;
  }

  /**
   * Elimina un objeto del Editor usando formato Editor.toJSON()
   */
  removeEditorObject(roomId, objectUuid) {
    try {
      const editorInfo = this.roomEditors.get(roomId);
      if (!editorInfo) {
        return { success: false, error: "No editor found for this room" };
      }

      // Verificar que el editor tenga el formato correcto
      if (!editorInfo.data.scene?.object?.children) {
        return { success: false, error: "Editor data format is invalid" };
      }

      // Función recursiva para buscar y eliminar el objeto por UUID
      const removeObjectFromHierarchy = (objects, targetUuid) => {
        for (let i = 0; i < objects.length; i++) {
          if (objects[i].uuid === targetUuid) {
            // Eliminar el objeto encontrado
            objects.splice(i, 1);
            return true;
          }

          // Buscar recursivamente en los hijos
          if (objects[i].children && objects[i].children.length > 0) {
            if (removeObjectFromHierarchy(objects[i].children, targetUuid)) {
              return true;
            }
          }
        }
        return false;
      };

      // Intentar eliminar el objeto de la jerarquía de la escena
      const removed = removeObjectFromHierarchy(
        editorInfo.data.scene.object.children,
        objectUuid
      );

      // Incrementar versión solo si se eliminó algo
      if (removed) {
        const newVersion = (this.editorVersions.get(roomId) || 0) + 1;
        editorInfo.version = newVersion;
        editorInfo.lastUpdate = Date.now();
        this.editorVersions.set(roomId, newVersion);
      }

      return { success: true, version: editorInfo.version, removed: removed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene estadísticas de editores
   */
  getStats() {
    // Función para contar objetos recursivamente en la jerarquía
    const countObjectsInHierarchy = (objects) => {
      if (!objects || !Array.isArray(objects)) return 0;

      let count = objects.length;
      for (const obj of objects) {
        if (obj.children && obj.children.length > 0) {
          count += countObjectsInHierarchy(obj.children);
        }
      }
      return count;
    };

    return {
      totalRooms: this.roomEditors.size,
      rooms: Array.from(this.roomEditors.entries()).map(
        ([roomId, editorInfo]) => ({
          roomId,
          version: editorInfo.version,
          lastUpdate: editorInfo.lastUpdate,
          objectCount: editorInfo.data?.scene?.object?.children
            ? countObjectsInHierarchy(editorInfo.data.scene.object.children)
            : 0,
          hostId: editorInfo.hostId,
        })
      ),
    };
  }

  /**
   * Limpia editores antiguos (opcional, para optimización)
   */
  cleanupOldEditors(maxAgeMs = 24 * 60 * 60 * 1000) {
    // 24 horas por defecto
    const now = Date.now();
    let cleaned = 0;

    for (const [roomId, editorInfo] of this.roomEditors.entries()) {
      if (now - editorInfo.lastUpdate > maxAgeMs) {
        this.deleteRoomEditor(roomId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[EditorManager] Cleaned ${cleaned} old editors`);
    }

    return cleaned;
  }
}

export default EditorManager;
