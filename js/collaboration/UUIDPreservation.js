/**
 * UUIDPreservation - Maneja la preservación de UUIDs de geometrías y materiales
 */
class UUIDPreservation {
  constructor(editor) {
    this.editor = editor;
    this.objectGeometryMap = new Map();
    this.objectMaterialMap = new Map();

    this.setup();
  }

  /**
   * Configura la preservación de UUIDs
   */
  setup() {
    // Interceptar objetos iniciales
    this.editor.scene.traverse((object) => {
      this.trackObject(object);
    });

    // Interceptar el método execute del editor
    this.interceptEditorCommands();

    // Escuchar cuando se agregan objetos
    this.editor.signals.objectAdded.add((object) => {
      this.trackObject(object);
    });

    // Escuchar cuando se remueven objetos
    this.editor.signals.objectRemoved.add((object) => {
      this.untrackObject(object);
    });

    // Interceptar señal geometryChanged
    this.interceptGeometrySignal();
  }

  /**
   * Rastrea un objeto para preservar sus UUIDs
   */
  trackObject(object) {
    if (object.geometry) {
      this.objectGeometryMap.set(object.id, object.geometry.uuid);
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        this.objectMaterialMap.set(
          object.id,
          object.material.map((m) => m.uuid)
        );
      } else {
        this.objectMaterialMap.set(object.id, object.material.uuid);
      }
    }
  }

  /**
   * Deja de rastrear un objeto
   */
  untrackObject(object) {
    if (this.objectGeometryMap.has(object.id)) {
      this.objectGeometryMap.delete(object.id);
    }
    if (this.objectMaterialMap.has(object.id)) {
      this.objectMaterialMap.delete(object.id);
    }
  }

  /**
   * Intercepta comandos del editor para preservar UUIDs
   */
  interceptEditorCommands() {
    const originalExecute = this.editor.execute.bind(this.editor);
    this.editor.execute = (command) => {
      // Capturar comandos de geometría
      if (command.type === "SetGeometryCommand" && command.object) {
        const object = command.object;
        const originalUUID =
          this.objectGeometryMap.get(object.id) ||
          (object.geometry ? object.geometry.uuid : null);

        if (originalUUID && command.newGeometry) {
          command.newGeometry.uuid = originalUUID;
        }
      }

      // Capturar comandos de material
      if (command.type === "SetMaterialCommand" && command.object) {
        const object = command.object;
        const materialSlot = command.materialSlot || 0;
        const originalMaterialUUIDs = this.objectMaterialMap.get(object.id);

        if (originalMaterialUUIDs && command.newMaterial) {
          if (Array.isArray(originalMaterialUUIDs)) {
            if (
              materialSlot >= 0 &&
              materialSlot < originalMaterialUUIDs.length
            ) {
              const originalUUID = originalMaterialUUIDs[materialSlot];
              command.newMaterial.uuid = originalUUID;
            }
          } else {
            command.newMaterial.uuid = originalMaterialUUIDs;
          }
        }
      }

      // Ejecutar comando original
      const result = originalExecute(command);

      // Actualizar mapas después de la ejecución
      if (
        command.type === "SetGeometryCommand" &&
        command.object &&
        command.object.geometry
      ) {
        this.objectGeometryMap.set(
          command.object.id,
          command.object.geometry.uuid
        );
      }

      if (
        command.type === "SetMaterialCommand" &&
        command.object &&
        command.object.material
      ) {
        if (Array.isArray(command.object.material)) {
          this.objectMaterialMap.set(
            command.object.id,
            command.object.material.map((m) => m.uuid)
          );
        } else {
          this.objectMaterialMap.set(
            command.object.id,
            command.object.material.uuid
          );
        }
      }

      return result;
    };
  }

  /**
   * Intercepta la señal geometryChanged
   */
  interceptGeometrySignal() {
    const originalGeometrySignal = this.editor.signals.geometryChanged;
    if (originalGeometrySignal && originalGeometrySignal.dispatch) {
      const originalDispatch = originalGeometrySignal.dispatch.bind(
        originalGeometrySignal
      );
      originalGeometrySignal.dispatch = (objectOrGeometry) => {
        // Si el parámetro es un objeto con geometría
        if (objectOrGeometry && objectOrGeometry.geometry) {
          const object = objectOrGeometry;
          const expectedUUID = this.objectGeometryMap.get(object.id);

          if (expectedUUID && object.geometry.uuid !== expectedUUID) {
            object.geometry.uuid = expectedUUID;
          }
        }

        return originalDispatch(objectOrGeometry);
      };
    }
  }

  /**
   * Actualiza mapas de UUID recursivamente para objetos complejos
   */
  updateUUIDMapsRecursively(object) {
    const traverseAndUpdate = (obj) => {
      // Actualizar geometría
      if (obj.geometry) {
        this.objectGeometryMap.set(obj.id, obj.geometry.uuid);
      }

      // Actualizar material(es)
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          this.objectMaterialMap.set(
            obj.id,
            obj.material.map((m) => m.uuid)
          );
        } else {
          this.objectMaterialMap.set(obj.id, obj.material.uuid);
        }
      }

      // Recorrer hijos recursivamente
      if (obj.children && obj.children.length > 0) {
        obj.children.forEach((child) => traverseAndUpdate(child));
      }
    };

    traverseAndUpdate(object);
  }

  /**
   * Limpia los mapas
   */
  dispose() {
    if (this.objectGeometryMap) {
      this.objectGeometryMap.clear();
    }
    if (this.objectMaterialMap) {
      this.objectMaterialMap.clear();
    }
  }
}

export { UUIDPreservation };
