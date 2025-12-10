import { UIPanel, UIRow, UIButton, UIInput, UIText } from "./libs/ui.js";

/**
 * Panel de UI para controlar la colaboración en tiempo real
 */
function CollaborationPanel(editor, collaborationManager) {
  loadCollaborationStyles();

  const container = new UIPanel();
  container.setClass("collaboration-panel");

  // Contenido principal
  createPanelHeader(container);
  const content = new UIPanel();
  content.setClass("collaboration-content");
  container.add(content);

  // Componentes del panel
  const statusRow = createConnectionStatus(content);
  createUserNameInput(content, collaborationManager);
  const roomControls = createRoomControls(content, collaborationManager);
  const currentRoomDisplay = createCurrentRoomDisplay(content);
  const availableRoomsSection = createAvailableRoomsSection(
    content,
    collaborationManager
  );
  const usersSection = createUsersSection(content);

  // Auto-refresh de salas
  const roomsAutoRefresh = setupRoomsAutoRefresh(collaborationManager);

  // Configurar eventos del collaboration manager
  setupCollaborationEvents(collaborationManager, {
    updateConnectionStatus: (isConnected, inRoom = false) =>
      updateConnectionStatus(
        isConnected,
        inRoom,
        statusRow,
        roomControls,
        roomsAutoRefresh
      ),
    updateCurrentRoom: (roomId) =>
      updateCurrentRoom(
        roomId,
        currentRoomDisplay,
        roomControls,
        collaborationManager
      ),
    updateUsersList: (users) => updateUsersList(users, usersSection.usersList),
    updateAvailableRooms: (rooms) =>
      updateAvailableRooms(
        rooms,
        availableRoomsSection.roomsList,
        collaborationManager,
        roomControls.roomInput
      ),
  });

  // Exponer métodos públicos
  container.updateConnectionStatus = (isConnected, inRoom) =>
    updateConnectionStatus(
      isConnected,
      inRoom,
      statusRow,
      roomControls,
      roomsAutoRefresh
    );
  container.updateCurrentRoom = (roomId) =>
    updateCurrentRoom(
      roomId,
      currentRoomDisplay,
      roomControls,
      collaborationManager
    );
  container.updateUsersList = (users) =>
    updateUsersList(users, usersSection.usersList);
  container.updateAvailableRooms = (rooms) =>
    updateAvailableRooms(
      rooms,
      availableRoomsSection.roomsList,
      collaborationManager,
      roomControls.roomInput
    );
  container.repositionPanel = () => repositionPanel(container);
  container.destroy = () => {
    roomsAutoRefresh.stop();
  };

  initializePanel(container, collaborationManager, roomsAutoRefresh);
  return container;
}

/**
 * Carga los archivos CSS necesarios para el panel
 */
function loadCollaborationStyles() {
  const cssFiles = [
    "css/collaboration-panel.css",
    "css/collaboration-animations.css",
  ];

  for (const cssFile of cssFiles) {
    if (!document.querySelector(`link[href$="${cssFile}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssFile;
      document.head.appendChild(link);
    }
  }
}

/**
 * Crea el header del panel con título y botón de colapsar
 */
function createPanelHeader(container) {
  const header = new UIPanel();
  header.setClass("collaboration-header");
  container.add(header);

  const title = new UIText("🤝 Colaboración");
  title.setClass("title");
  header.add(title);

  const collapseBtn = new UIButton("−");
  collapseBtn.setClass("collapse-btn");
  collapseBtn.onClick(() => togglePanelCollapse(container, collapseBtn));
  header.add(collapseBtn);

  return header;
}

/**
 * Alterna el estado colapsado del panel
 */
function togglePanelCollapse(container, collapseBtn) {
  const isCollapsed = container.dom.classList.contains("collapsed");

  if (isCollapsed) {
    container.dom.classList.remove("collapsed");
    collapseBtn.dom.textContent = "−";
  } else {
    container.dom.classList.add("collapsed");
    collapseBtn.dom.textContent = "+";
  }
}

/**
 * Crea la sección de estado de conexión
 */
function createConnectionStatus(content) {
  const statusRow = new UIRow();
  statusRow.setClass("collaboration-status disconnected");
  content.add(statusRow);

  const statusDot = document.createElement("div");
  statusDot.className = "status-dot disconnected";
  statusRow.dom.appendChild(statusDot);

  const statusText = new UIText("Desconectado");
  statusText.setClass("status-text");
  statusRow.add(statusText);

  return { container: statusRow, dot: statusDot, text: statusText };
}

/**
 * Crea el campo de entrada para el nombre de usuario
 */
function createUserNameInput(content, collaborationManager) {
  const userNameRow = new UIRow();
  userNameRow.setClass("form-row");
  content.add(userNameRow);

  const userNameLabel = new UIText("👤 Usuario:");
  userNameLabel.setClass("form-label");
  userNameRow.add(userNameLabel);

  const userNameInput = new UIInput("");
  userNameInput.setClass("form-input");
  userNameInput.dom.placeholder = "Anónimo";

  // Cargar nombre guardado
  const savedName = localStorage.getItem("collaboration-username") || "";
  if (savedName) {
    userNameInput.setValue(savedName);
  }

  // Guardar cambios
  userNameInput.dom.addEventListener("change", () => {
    const newName = userNameInput.getValue().trim();
    localStorage.setItem("collaboration-username", newName);

    if (collaborationManager?.isConnected) {
      collaborationManager.updateUserName(newName || "Anónimo");
    }
  });

  userNameRow.add(userNameInput);
  return userNameInput;
}

/**
 * Crea los controles de sala (nombre, contraseña, botones)
 */
function createRoomControls(content, collaborationManager) {
  const roomControls = new UIPanel();
  roomControls.setClass("room-controls");
  content.add(roomControls);

  // Check if form already exists to avoid double wrapping if tool runs twice conceptually, but here we replace the block.
  // Room controls form wrapper
  const form = document.createElement("form");
  form.className = "room-controls-form";
  form.onsubmit = (e) => { e.preventDefault(); };
  roomControls.dom.appendChild(form);

  // Nombre de sala
  const roomNameRow = new UIRow();
  roomNameRow.setClass("form-row");
  // Change to append to form instead of roomControls
  form.appendChild(roomNameRow.dom);

  const roomNameLabel = new UIText("🏠 Sala:");
  roomNameLabel.setClass("form-label");
  roomNameRow.add(roomNameLabel);

  const roomInput = new UIInput("");
  roomInput.setClass("form-input");
  roomInput.dom.placeholder = "Nombre de sala...";
  roomInput.dom.name = "roomName";
  // Autocomplete attribute
  roomInput.dom.autocomplete = "off";
  roomNameRow.add(roomInput);

  // Campo de contraseña
  const passwordRow = new UIRow();
  passwordRow.setClass("form-row");
  // Change to append to form
  form.appendChild(passwordRow.dom);

  const passwordLabel = new UIText("🔒 Clave:");
  passwordLabel.setClass("form-label");
  passwordRow.add(passwordLabel);

  const passwordInput = new UIInput("");
  passwordInput.setClass("form-input");
  passwordInput.dom.type = "password";
  passwordInput.dom.placeholder = "Contraseña (opcional)...";
  passwordInput.dom.name = "roomPassword";
  passwordInput.dom.autocomplete = "current-password";
  passwordRow.add(passwordInput);

  // Botones de acción
  const buttonsRow = new UIRow();
  buttonsRow.setClass("buttons-row");
  roomControls.add(buttonsRow);

  const joinBtn = new UIButton("🚪 Unirse");
  joinBtn.setClass("btn");
  joinBtn.onClick(() => {
    const roomId = roomInput.getValue().trim();
    const password = passwordInput.getValue().trim();
    if (roomId) {
      collaborationManager.joinRoom(roomId, password || null);
    }
  });
  buttonsRow.add(joinBtn);

  const createBtn = new UIButton("🏠 Crear");
  createBtn.setClass("btn");
  createBtn.onClick(() => {
    let roomId = roomInput.getValue().trim();
    const password = passwordInput.getValue().trim();

    if (!roomId) {
      roomId = collaborationManager.generateRoomId();
      roomInput.setValue(roomId);
    }

    collaborationManager.createRoom(roomId, password || null);
  });
  buttonsRow.add(createBtn);

  // Botón para salir de sala
  const leaveRoomRow = new UIRow();
  leaveRoomRow.setClass("leave-room-row");
  const leaveBtn = new UIButton("🚪 SALIR DE LA SALA");
  leaveBtn.setClass("btn btn-secondary");
  leaveBtn.onClick(() => {
    const isHost = collaborationManager?.isHost;
    if (isHost) {
      collaborationManager.deleteRoom();
    } else {
      collaborationManager.leaveRoom();
    }
    roomInput.setValue("");
    passwordInput.setValue("");
  });
  leaveRoomRow.add(leaveBtn);
  roomControls.add(leaveRoomRow);

  return {
    container: roomControls,
    roomInput,
    passwordInput,
    joinBtn,
    createBtn,
    leaveBtn,
    leaveRoomRow,
  };
}

/**
 * Crea la visualización de la sala actual
 */
function createCurrentRoomDisplay(content) {
  const currentRoomRow = new UIRow();
  const currentRoomText = new UIText("");
  currentRoomText.setClass("current-room-info");
  currentRoomRow.add(currentRoomText);
  content.add(currentRoomRow);
  return { container: currentRoomRow, text: currentRoomText };
}

/**
 * Crea la sección de salas disponibles
 */
function createAvailableRoomsSection(content, collaborationManager) {
  const availableRoomsSection = new UIPanel();
  availableRoomsSection.setClass("rooms-section");
  content.add(availableRoomsSection);

  const roomsTitle = new UIText("🚪 Salas disponibles:");
  roomsTitle.setClass("section-title");
  availableRoomsSection.add(roomsTitle);

  const roomsListContainer = new UIPanel();
  roomsListContainer.setClass("rooms-list-container");
  availableRoomsSection.add(roomsListContainer);

  const roomsList = new UIPanel();
  roomsList.setClass("rooms-list");
  roomsListContainer.add(roomsList);

  const refreshRoomsBtn = new UIButton("🔄 Actualizar");
  refreshRoomsBtn.setClass("btn btn-small");
  refreshRoomsBtn.onClick(() => {
    if (collaborationManager?.isConnected) {
      collaborationManager.getRooms();
    }
  });
  availableRoomsSection.add(refreshRoomsBtn);

  return {
    container: availableRoomsSection,
    roomsList,
    refreshBtn: refreshRoomsBtn,
  };
}

/**
 * Crea la sección de usuarios conectados
 */
function createUsersSection(content) {
  const usersSection = new UIPanel();
  usersSection.setClass("users-section");
  content.add(usersSection);

  const usersTitle = new UIText("👥 Usuarios conectados:");
  usersTitle.setClass("section-title");
  usersSection.add(usersTitle);

  const usersList = new UIPanel();
  usersList.setClass("users-list");
  usersSection.add(usersList);

  return { container: usersSection, usersList };
}

/**
 * Configura el auto-refresh de salas
 */
function setupRoomsAutoRefresh(collaborationManager) {
  let intervalId = null;
  let isRefreshing = false;

  return {
    start: () => {
      if (!intervalId) {
        intervalId = setInterval(async () => {
          if (collaborationManager?.isConnected && !isRefreshing) {
            isRefreshing = true;
            try {
              await collaborationManager.getRooms();
            } catch (error) {
              console.error("Error refreshing rooms:", error);
              isRefreshing = false;
            }
          }
        }, 15000);
      }
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        isRefreshing = false;
      }
    },
  };
}

/**
 * Configura los eventos del collaboration manager
 */
function setupCollaborationEvents(collaborationManager, callbacks) {
  if (!collaborationManager) return;

  collaborationManager.socket?.on("connect", () => {
    callbacks.updateConnectionStatus(true);
  });

  collaborationManager.socket?.on("disconnect", () => {
    callbacks.updateConnectionStatus(false);
    callbacks.updateCurrentRoom(null);
    callbacks.updateUsersList([]);
  });
}

/**
 * Actualiza el estado de conexión
 */
function updateConnectionStatus(
  isConnected,
  inRoom,
  statusRow,
  roomControls,
  roomsAutoRefresh
) {
  // Limpiar clases existentes
  statusRow.container.dom.className = "collaboration-status";

  // Aplicar nueva clase según el estado
  if (isConnected) {
    statusRow.container.dom.classList.add("connected");
    statusRow.dot.className = "status-dot connected";
    statusRow.text.setTextContent("Conectado");
  } else {
    statusRow.container.dom.classList.add("disconnected");
    statusRow.dot.className = "status-dot disconnected";
    statusRow.text.setTextContent("Desconectado");
  }

  // Gestionar visibilidad de botones
  const shouldShowRoomControls = isConnected && !inRoom;
  if (shouldShowRoomControls) {
    roomControls.joinBtn.dom.classList.remove("hidden");
    roomControls.createBtn.dom.classList.remove("hidden");
    roomControls.joinBtn.dom.disabled = false;
    roomControls.createBtn.dom.disabled = false;
  } else {
    roomControls.joinBtn.dom.classList.add("hidden");
    roomControls.createBtn.dom.classList.add("hidden");
  }

  // Gestionar auto-refresh con optimización para evitar parpadeo
  if (shouldShowRoomControls) {
    roomsAutoRefresh.start();
  } else {
    roomsAutoRefresh.stop();
  }
}

/**
 * Actualiza la información de la sala actual
 */
function updateCurrentRoom(
  roomId,
  currentRoomDisplay,
  roomControls,
  collaborationManager
) {
  if (roomId) {
    const isHost = collaborationManager?.isHost;
    const roleText = isHost ? " (Anfitrión)" : " (Invitado)";

    currentRoomDisplay.text.setTextContent(
      `🏠 Sala actual: ${roomId}${roleText}`
    );
    currentRoomDisplay.container.dom.style.display = "block";
    roomControls.joinBtn.dom.classList.add("hidden");
    roomControls.createBtn.dom.classList.add("hidden");
    roomControls.leaveRoomRow.dom.classList.add("visible");

    if (isHost) {
      roomControls.leaveBtn.dom.textContent = "🗑️ Eliminar Sala";
      roomControls.leaveBtn.dom.classList.add("btn-danger");
      roomControls.leaveBtn.dom.classList.remove("btn-secondary");
    } else {
      roomControls.leaveBtn.dom.textContent = "⬅ Salir de Sala";
      roomControls.leaveBtn.dom.classList.add("btn-secondary");
      roomControls.leaveBtn.dom.classList.remove("btn-danger");
    }
  } else {
    currentRoomDisplay.container.dom.style.display = "none";
    roomControls.leaveRoomRow.dom.classList.remove("visible");

    if (collaborationManager?.isConnected) {
      roomControls.joinBtn.dom.classList.remove("hidden");
      roomControls.createBtn.dom.classList.remove("hidden");
    }
  }
}

/**
 * Actualiza la lista de usuarios
 */
function updateUsersList(users, usersList) {
  // Limpiar lista
  while (usersList.dom.firstChild) {
    usersList.dom.firstChild.remove();
  }

  if (users.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-message";
    emptyMsg.textContent = "No hay usuarios conectados";
    usersList.dom.appendChild(emptyMsg);
    return;
  }

  for (const user of users) {
    const userItem = document.createElement("div");
    userItem.className = "user-item";

    const indicator = document.createElement("div");
    indicator.className = "user-indicator";
    userItem.appendChild(indicator);

    const userName = document.createElement("span");
    userName.className = `user-name ${user.role === "host" ? "host" : ""}`;
    const displayName = user.name || "Anónimo";
    const roleIcon = user.role === "host" ? " 👑" : "";
    userName.textContent = displayName + roleIcon;
    userItem.appendChild(userName);

    const userIdSpan = document.createElement("span");
    userIdSpan.className = "user-id";
    userIdSpan.textContent = user.id.substring(0, 8);
    userItem.appendChild(userIdSpan);

    userItem.title = `ID: ${user.id}`;
    usersList.dom.appendChild(userItem);
  }
}

/**
 * Actualiza la lista de salas disponibles
 */
function updateAvailableRooms(
  rooms,
  roomsList,
  collaborationManager,
  roomInput
) {
  // Limpiar lista actual
  roomsList.dom.innerHTML = "";

  // Si no hay salas, mostrar mensaje vacío
  if (!rooms || rooms.length === 0) {
    // ... (mensaje vacío)
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-message fade-in";
    emptyMsg.textContent = "No hay salas disponibles";
    roomsList.dom.appendChild(emptyMsg);
    return;
  }

  // Debug log
  // console.log('Renderizando salas:', rooms.length);

  // Crear elementos de salas
  for (const room of rooms) {
    try {
      if (!room) continue;
      const roomItem = createRoomItem(room, collaborationManager, roomInput);
      roomItem.classList.add("room-item", "fade-in");
      roomsList.dom.appendChild(roomItem);
    } catch (err) {
      console.error('Error renderizando item de sala:', err, room);
    }
  }
}

/**
 * Crea un elemento de sala en la lista con información de servidor
 */
function createRoomItem(room, collaborationManager, roomInput) {
  if (!collaborationManager) {
    console.error('createRoomItem: collaborationManager is undefined');
  }

  const roomItem = document.createElement("div");
  roomItem.className = "room-item";

  // Agregar ID de la sala como data attribute para rastreo
  const roomId = room.id || room.name || room || "Sala desconocida";
  roomItem.dataset.roomId = roomId;

  // Determinar clase CSS basada en servidor
  if (room.serverInstance) {
    // Safety check
    const currentServer = collaborationManager?.getCurrentServerInstance ?
      collaborationManager.getCurrentServerInstance() : 'current';

    if (room.serverInstance === currentServer) {
      roomItem.classList.add("server-current");
    } else if (room.serverInstance === 'server-1' || room.serverInstance === 'server-2') {
      roomItem.classList.add(`server-${room.serverInstance.includes('server-') ? room.serverInstance.split('-')[1] : 'remote'}`);
    }
  }

  // Marcar como servidor óptimo si aplica
  if (room.isOptimal) {
    roomItem.classList.add("optimal-server");
  }

  // Header de la sala
  const roomHeader = document.createElement("div");
  roomHeader.className = "room-header";

  // ID de la sala con badge de servidor
  const roomIdElement = document.createElement("div");
  roomIdElement.className = `room-id ${room.isProtected ? "protected" : ""}`;

  // Texto básico del ID
  let idText = roomId + (room.isProtected ? " 🔒" : "");
  roomIdElement.textContent = idText;

  // Clean header - no badges here as requested
  roomHeader.appendChild(roomIdElement);
  roomItem.appendChild(roomHeader);

  // Información de la sala (Metadata en una sola línea)
  const roomInfo = document.createElement("div");
  roomInfo.className = "room-info";

  // Usar displayInfo unificado que viene del manager
  if (room.displayInfo) {
    const displayInfo = document.createElement("div");
    displayInfo.className = "room-display-info";
    // Asegurar que no haya saltos de línea, usar flex o inline-block en CSS si es necesario
    displayInfo.textContent = room.displayInfo;
    roomInfo.appendChild(displayInfo);
  } else {
    // Fallback por si no hay displayInfo (no debería pasar con el fix)
    const userCount = room.userCount || 0;
    roomInfo.textContent = `${userCount}👥`;
  }

  roomItem.appendChild(roomInfo);

  // Indicador de estado (editor/sala vacía)
  const statusIndicator = document.createElement("div");
  statusIndicator.className = `room-status-indicator ${room.hasEditor ? "has-editor" : ""
    }`;
  statusIndicator.title = room.hasEditor ? "Tiene editor" : "Sala vacía";
  roomItem.appendChild(statusIndicator);

  // Tooltip con información detallada del servidor
  if (room.serverInstance) {
    let tooltipText = `Servidor: ${room.serverInstance}`;
    if (room.serverLatency !== undefined) {
      tooltipText += ` • Latencia: ${room.serverLatency}ms`;
    }
    if (room.isOptimal) {
      tooltipText += " • Servidor óptimo";
    }
    roomItem.classList.add("server-tooltip");
    roomItem.setAttribute("data-tooltip", tooltipText);
  }

  // Evento de click
  roomItem.addEventListener("click", () =>
    handleRoomItemClick(room, collaborationManager, roomInput)
  );

  return roomItem;
}

/**
 * Maneja el click en un elemento de sala
 */
function handleRoomItemClick(room, collaborationManager, roomInput) {
  const currentRoom = collaborationManager?.currentRoom;
  if (currentRoom) {
    const isHost = collaborationManager?.isHost;
    const action = isHost ? "elimina" : "sal de";
    collaborationManager.showNotification(
      `Ya estás en la sala "${currentRoom}". ${action.charAt(0).toUpperCase() + action.slice(1)
      } la sala actual primero.`,
      "error"
    );
    return;
  }

  // Colocar el nombre de la sala en el campo de entrada
  if (roomInput && room.id) {
    roomInput.setValue(room.id);
  }
}

/**
 * Reposiciona el panel
 */
function repositionPanel(container) {
  const isCollapsed = container.dom.classList.contains("collapsed");
  // El CSS ya maneja el posicionamiento, solo necesitamos asegurar las clases
  if (!isCollapsed) {
    container.dom.style.display = "block";
  }
}

/**
 * Inicializa el panel con valores por defecto
 */
function initializePanel(container, collaborationManager, roomsAutoRefresh) {
  const isConnected = collaborationManager?.isConnected || false;
  const currentRoom = collaborationManager?.currentRoom || null;

  // Actualizar estado inicial
  container.updateConnectionStatus(isConnected, !!currentRoom);
  container.updateCurrentRoom(currentRoom);
  container.updateUsersList([]);
  container.updateAvailableRooms([]);

  // Iniciar auto-refresh si está conectado
  if (isConnected) {
    roomsAutoRefresh.start();
  }
}

export { CollaborationPanel };
