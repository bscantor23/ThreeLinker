import * as THREE from "three";

globalThis.THREE = THREE;

const scripts = [
  "./Editor.js",
  "./Viewport.js",
  "./Toolbar.js",
  "./Script.js",
  "./Player.js",
  "./Sidebar.js",
  "./Menubar.js",
  "./Resizer.js",
  "./Config.js",
  "./Loader.js",
  "./History.js",
  "./Strings.js",
  "./Storage.js",
  "./Selector.js",
];

for (const scriptPath of scripts) {
  try {
    await import(/* @vite-ignore */ scriptPath);
  } catch (error) {
    console.warn(`Could not load ${scriptPath}:`, error);
  }
}

console.log("Three.js Editor loaded with Vite");

// Inicializar colaboración después de que todo esté cargado
async function initializeCollaboration() {
  try {
    console.log("[Main] Starting collaboration initialization...");

    // Importar el CollaborationManager
    const { CollaborationManager } = await import("./CollaborationManager.js");

    // Esperar a que el editor esté disponible
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo

    const waitForEditor = () => {
      return new Promise((resolve, reject) => {
        const checkEditor = () => {
          attempts++;
          if (globalThis.editor) {
            console.log("[Main] Editor found, initializing collaboration...");
            resolve(globalThis.editor);
          } else if (attempts >= maxAttempts) {
            reject(new Error("Editor not found after maximum attempts"));
          } else {
            setTimeout(checkEditor, 100);
          }
        };
        checkEditor();
      });
    };

    const editor = await waitForEditor();

    // Crear e inicializar el CollaborationManager
    globalThis.collaborationManager = new CollaborationManager(editor);

    console.log("[Main] Collaboration system initialized successfully");

    // Agregar panel de colaboración al sidebar después de un breve delay
    setTimeout(async () => {
      try {
        const { CollaborationPanel } = await import(
          "./CollaborationPanel.js"
        );
        const collaborationPanel = CollaborationPanel(
          editor,
          globalThis.collaborationManager
        );

        // Buscar el sidebar y agregar la pestaña
        const sidebar = document.querySelector("#sidebar");
        if (sidebar && sidebar.addTab) {
          sidebar.addTab("collaboration", "Colaboración", collaborationPanel);
          console.log("[Main] Collaboration panel added to sidebar");
        }

        globalThis.collaborationPanel = collaborationPanel;
      } catch (error) {
        console.warn("[Main] Could not add collaboration panel:", error);
      }
    }, 1000);
  } catch (error) {
    console.error("[Main] Failed to initialize collaboration:", error);
  }
}

// Inicializar colaboración
setTimeout(initializeCollaboration, 1000);
