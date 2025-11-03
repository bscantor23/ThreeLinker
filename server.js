import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { setupCollaborationServer } from "./server/collaborationServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // Configuración para archivos grandes
  maxHttpBufferSize: 10e6, // 10MB
  pingTimeout: 60000, // 60 segundos
  pingInterval: 25000, // 25 segundos
  connectTimeout: 60000, // 60 segundos timeout para conexión
  allowEIO3: true,
  transports: ['websocket', 'polling'],
});

// Servir archivos estáticos
app.use(express.static(__dirname));

// Configurar sistema de colaboración
const collaboration = setupCollaborationServer(io);

// Ruta para estadísticas del servidor (opcional, para debugging)
app.get('/api/stats', (req, res) => {
  res.json(collaboration.getStats());
});

// Ruta para salud del servidor
app.get('/api/health', (req, res) => {
  res.json(collaboration.utils.getHealth());
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log("Editor de three.js con colaboración en tiempo real listo!");
  
  // Mostrar módulos cargados
  console.log("Módulos de colaboración cargados:", {
    roomManager: "✓",
    userManager: "✓",
    socketHandlers: "✓"
  });
});

// Manejar cierre limpio del servidor
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  collaboration.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nCerrando servidor...');
  collaboration.shutdown();
  process.exit(0);
});
