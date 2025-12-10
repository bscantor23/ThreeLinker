/**
 * Editor Handlers - Maneja todos los eventos relacionados con sincronización del Editor
 */

/**
 * Configurar todos los event handlers del Editor
 */
function setupEditorHandlers(
  socket,
  io,
  roomManager,
  userManager,
  editorManager
) {
  // Solicitar sincronización inicial del editor al unirse a una sala
  socket.on("request-editor-sync", (data) => {
    handleRequestEditorSync(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Cualquier usuario envía el editor completo
  socket.on("sync-full-editor", (data) => {
    handleSyncFullEditor(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Actualización de objeto individual
  socket.on("sync-editor-object-update", (data) => {
    handleSyncEditorObjectUpdate(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Actualización de material individual
  socket.on("sync-editor-material-update", (data) => {
    handleSyncEditorMaterialUpdate(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Elimina un objeto del editor (cualquier usuario)
  socket.on("sync-editor-object-removal", (data) => {
    handleSyncEditorObjectRemoval(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Cambios de propiedades de escena
  socket.on("sync-scene-background-update", (data) => {
    handleSyncSceneBackgroundUpdate(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  socket.on("sync-scene-fog-update", (data) => {
    handleSyncSceneFogUpdate(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  // Cambios de scripts
  socket.on("sync-script-added", (data) => {
    handleSyncScriptAdded(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  socket.on("sync-script-changed", (data) => {
    handleSyncScriptChanged(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });

  socket.on("sync-script-removed", (data) => {
    handleSyncScriptRemoved(
      io,
      socket,
      data,
      roomManager,
      userManager,
      editorManager
    );
  });
}

/**
 * Maneja solicitud de sincronización del editor
 */
async function handleRequestEditorSync(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId } = data;
    if (!roomId) {
      socket.emit("editor-sync-error", { error: "Room ID is required" });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user) {
      socket.emit("editor-sync-error", { error: "User not found" });
      return;
    }

    // Verificar que la sala existe
    const room = roomManager.getRoomSync(roomId);
    if (!room) {
      socket.emit("editor-sync-error", { error: "Room not found" });
      return;
    }

    // Obtener el editor de la sala
    const editorResult = await editorManager.getRoomEditor(roomId);

    // Verificar que hay datos del editor
    if (!editorResult.success || !editorResult.editorData) {
      socket.emit("receive-full-editor", {
        editorData: null,
        version: 0,
        hostId: null,
        lastUpdate: new Date().toISOString(),
        isInitialSync: true,
      });
      return;
    }

    // Enviar editor al usuario
    socket.emit("receive-full-editor", {
      editorData: editorResult.editorData,
      version: editorResult.version,
      hostId: editorResult.hostId,
      lastUpdate: editorResult.lastUpdate,
      isInitialSync: true,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización completa del editor (cualquier usuario)
 */
async function handleSyncFullEditor(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, editorData } = data;
    if (!roomId || !editorData) {
      socket.emit("editor-sync-error", {
        error: "Room ID and editor data are required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user) {
      socket.emit("editor-sync-error", { error: "User not found" });
      return;
    }

    const room = roomManager.getRoomSync(roomId);
    if (!room || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", { error: "User not in specified room" });
      return;
    }

    // Guardar el editor en el manager
    const result = await editorManager.setRoomEditor(roomId, editorData, user.id);

    if (!result.success) {
      socket.emit("sync-full-editor-error", { error: result.error });
      return;
    }

    // Enviar confirmación al usuario que originó la sincronización
    socket.emit("sync-full-editor-success", {
      version: result.version,
      timestamp: Date.now(),
      message: "Editor synchronized successfully",
    });

    // Enviar el editor a todos los usuarios en la sala EXCEPTO el que originó el cambio
    // USAR socket.to(roomId) para soporte multi-server (Redis Adapter)
    socket.to(roomId).emit("receive-full-editor", {
      editorData: editorData,
      version: result.version,
      hostId: user.id,
      lastUpdate: Date.now(),
      originUserId: user.id,
    });

  } catch (error) {
    socket.emit("sync-full-editor-error", { error: "Internal server error" });
  }
}

/**
 * Maneja la eliminación de objetos del editor
 */
async function handleSyncEditorObjectRemoval(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, objectId } = data;

    // Validación más detallada
    if (!roomId || !objectId) {
      socket.emit("editor-sync-error", {
        error: "Room ID and object ID are required for object removal",
        code: "MISSING_DATA",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user) {
      socket.emit("editor-sync-error", {
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    const room = roomManager.getRoomSync(roomId);
    if (!room?.users.has(user.id)) {
      socket.emit("editor-sync-error", {
        error: "User not in room",
        code: "USER_NOT_IN_ROOM",
      });
      return;
    }

    // Eliminar el objeto del editor en el manager
    const result = await editorManager.removeEditorObject(roomId, objectId, user.id);

    if (!result.success) {
      socket.emit("editor-sync-error", {
        error: result.error,
        code: "REMOVAL_FAILED",
      });
      return;
    }

    // Enviar eliminación a todos los usuarios en la sala (incluido el que originó el cambio)
    // Enviar eliminación a todos los usuarios en la sala (incluido el que originó el cambio si usamos io.to)
    // Pero aquí queremos excluir al remitente si usó socket.to? No, el cliente espera confirmación?
    // El cliente original recibe confirmación vía callback o update. 
    // Usualmente object removal se debe propagar a OTROS.

    socket.to(roomId).emit("receive-editor-object-removal", {
      objectId: objectId,
      removedBy: user.id,
      timestamp: Date.now(),
      originUserId: user.id,
      version: result.version,
    });

    // Al remitente también le confirmamos (opcional, pero buena práctica si el cliente espera evento)
    socket.emit("receive-editor-object-removal", {
      objectId: objectId,
      removedBy: user.id,
      timestamp: Date.now(),
      originUserId: user.id,
      version: result.version,
    });

  } catch (error) {
    socket.emit("editor-sync-error", {
      error: "Internal server error during object removal",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Maneja sincronización de actualización de objeto individual
 */
function handleSyncEditorObjectUpdate(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, objectData, objectUuid, changeType } = data;
    if (!roomId || !objectData || !objectUuid) {
      socket.emit("editor-sync-error", {
        error: "Room ID, object data, and object UUID are required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala (seguridad básica)
    // Nota: Aunque el usuario esté en otro nodo, si este socket emitió el evento,
    // tenemos su ID aquí en 'socket.id'.
    // Si la validación de usuario falla porque userManager solo tiene locales, 
    // podríamos relajarla o confiar en que socket.id está en la sala.
    // Asumiremos que si el socket envió el evento, es un usuario válido.

    // Broadcast directo a la sala (Redis Adapter se encarga de distribuirlo a otros nodos)
    // socket.to(roomId) envía a todos en la sala EXCEPTO al remitente.
    socket.to(roomId).emit("receive-editor-object-update", {
      objectData: objectData,
      objectUuid: objectUuid,
      changeType: changeType || "general",
      updatedBy: socket.id, // Usamos socket.id como ID de usuario
      timestamp: Date.now(),
      originUserId: socket.id,
    });

  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de actualización de material individual
 */
function handleSyncEditorMaterialUpdate(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, materialData, materialUuid } = data;
    if (!roomId || !materialData || !materialUuid) {
      socket.emit("editor-sync-error", {
        error: "Room ID, material data, and material UUID are required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-editor-material-update", {
      materialData: materialData,
      materialUuid: materialUuid,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de cambio de background de escena
 */
function handleSyncSceneBackgroundUpdate(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, backgroundData } = data;

    if (!roomId) {
      socket.emit("editor-sync-error", {
        error: "Room ID is required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-scene-background-update", {
      backgroundData: backgroundData,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de cambio de fog de escena
 */
function handleSyncSceneFogUpdate(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, fogData } = data;

    if (!roomId) {
      socket.emit("editor-sync-error", {
        error: "Room ID is required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-scene-fog-update", {
      fogData: fogData,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de script agregado
 */
function handleSyncScriptAdded(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, objectUuid, script } = data;

    if (!roomId) {
      socket.emit("editor-sync-error", {
        error: "Room ID is required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-script-added", {
      objectUuid: objectUuid,
      script: script,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de script modificado
 */
function handleSyncScriptChanged(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, objectUuid, script } = data;

    if (!roomId) {
      socket.emit("editor-sync-error", {
        error: "Room ID is required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-script-changed", {
      objectUuid: objectUuid,
      script: script,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

/**
 * Maneja sincronización de script eliminado
 */
function handleSyncScriptRemoved(
  io,
  socket,
  data,
  roomManager,
  userManager,
  editorManager
) {
  try {
    const { roomId, objectUuid, script } = data;

    if (!roomId) {
      socket.emit("editor-sync-error", {
        error: "Room ID is required",
      });
      return;
    }

    // Verificar que el usuario esté en la sala
    const user = userManager.getUser(socket.id);
    if (!user || user.currentRoom !== roomId) {
      socket.emit("editor-sync-error", {
        error: "User not found or not in room",
      });
      return;
    }

    // Enviar la actualización a todos los otros usuarios en la sala
    socket.to(roomId).emit("receive-script-removed", {
      objectUuid: objectUuid,
      script: script,
      updatedBy: socket.id,
      timestamp: Date.now(),
      originUserId: socket.id,
    });
  } catch (error) {
    socket.emit("editor-sync-error", { error: "Internal server error" });
  }
}

export default setupEditorHandlers;

export { setupEditorHandlers };
