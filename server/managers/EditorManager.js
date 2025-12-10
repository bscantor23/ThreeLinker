/**
 * EditorManager - Gestiona la sincronización de datos del Editor Three.js entre usuarios
 */
class EditorManager {
  constructor(redisManager) {
    this.redisManager = redisManager;
    this.roomEditors = new Map(); // Cache local: roomId -> editorData
    this.editorVersions = new Map(); // Cache local: roomId -> version number
    this.keyPrefix = "editor:"; // Prefijo para Redis
  }

  /**
   * Almacena los datos completos del Editor de una sala
   */
  async setRoomEditor(roomId, editorData, hostId) {
    try {
      // Validar que el editorData sea válido
      if (!editorData || typeof editorData !== "object") {
        throw new Error("Editor data must be a valid object");
      }

      // Obtener versión actual (de memoria o Redis)
      let currentVersion = this.editorVersions.get(roomId) || 0;
      if (currentVersion === 0 && this.redisManager) {
        const stored = await this.redisManager.get(`${this.keyPrefix}${roomId}`);
        if (stored) currentVersion = stored.version;
      }

      const newVersion = currentVersion + 1;

      const editorInfo = {
        data: editorData,
        hostId: hostId,
        lastUpdate: Date.now(),
        version: newVersion,
      };

      // 1. Actualizar memoria local
      this.roomEditors.set(roomId, editorInfo);
      this.editorVersions.set(roomId, newVersion);

      // 2. Sincronizar con Redis (si está disponible)
      if (this.redisManager) {
        // Guardar estado completo. Nota: Para escenas muy grandes esto puede ser pesado.
        // Idealmente usaríamos JSON.stringify, pero redisManager.set ya lo maneja si es objeto.
        await this.redisManager.set(
          `${this.keyPrefix}${roomId}`,
          editorInfo,
          24 * 60 * 60 // TTL 24 horas
        );
      }

      return { success: true, version: newVersion };
    } catch (error) {
      console.error("[EditorManager] Error setting room editor:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene los datos completos del Editor de una sala
   */
  async getRoomEditor(roomId) {
    // 1. Intentar desde memoria local primero (para velocidad)
    let editorInfo = this.roomEditors.get(roomId);

    // 2. Si no está en memoria, intentar desde Redis
    if (!editorInfo && this.redisManager) {
      try {
        editorInfo = await this.redisManager.get(`${this.keyPrefix}${roomId}`);
        if (editorInfo) {
          // Hidratar caché local
          this.roomEditors.set(roomId, editorInfo);
          this.editorVersions.set(roomId, editorInfo.version);
        }
      } catch (err) {
        console.error("[EditorManager] Error fetching from Redis:", err);
      }
    }

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
  async hasRoomEditor(roomId) {
    if (this.roomEditors.has(roomId)) return true;
    if (this.redisManager) {
      const exists = await this.redisManager.get(`${this.keyPrefix}${roomId}`);
      return !!exists;
    }
    return false;
  }

  /**
   * Obtiene la versión actual del Editor de una sala
   */
  /**
   * Obtiene la versión actual del Editor de una sala
   */
  async getEditorVersion(roomId) {
    let version = this.editorVersions.get(roomId);
    if (version === undefined && this.redisManager) {
      const info = await this.redisManager.get(`${this.keyPrefix}${roomId}`);
      if (info) {
        version = info.version;
        this.editorVersions.set(roomId, version);
      }
    }
    return version || 0;
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
  /**
   * Elimina un objeto del Editor usando formato Editor.toJSON()
   */
  async removeEditorObject(roomId, objectUuid) {
    try {
      // 1. Intentar obtener de memoria primero, luego Redis
      await this.getRoomEditor(roomId); // Esto hidrata la caché si es necesario

      const editorInfo = this.roomEditors.get(roomId);
      if (!editorInfo) {
        return { success: false, error: "No editor found for this room" };
      }

      // Validar estructura básica pero ser flexible con children
      if (!editorInfo.data.scene?.object) {
        // Solo si falta la estructura principal reportamos error
        return { success: false, error: "Editor data scene structure is invalid" };
      }

      // Si no hay children, asumimos arreglo vacío (escena vacía)
      const rootChildren = editorInfo.data.scene.object.children || [];

      // Función recursiva para buscar y eliminar el objeto por UUID
      const removeObjectFromHierarchy = (objects, targetUuid) => {
        if (!objects || !Array.isArray(objects)) return false;

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
        rootChildren,
        objectUuid
      );

      // Incrementar versión solo si se eliminó algo
      if (removed) {
        const newVersion = (await this.getEditorVersion(roomId)) + 1;
        editorInfo.version = newVersion;
        editorInfo.lastUpdate = Date.now();
        this.editorVersions.set(roomId, newVersion);

        // Sincronizar actualización con Redis
        if (this.redisManager) {
          await this.redisManager.set(
            `${this.keyPrefix}${roomId}`,
            editorInfo,
            24 * 60 * 60
          );
        }
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
