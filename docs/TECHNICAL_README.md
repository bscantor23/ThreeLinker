# ThreeLinker - Documentación Técnica

## 🚀 Introducción

**ThreeLinker** es una plataforma colaborativa avanzada de edición 3D construida sobre **Three.js**, diseñada para permitir la creación y manipulación de escenas tridimensionales en tiempo real entre múltiples usuarios. El sistema aprovecha tecnologías web modernas para proporcionar una experiencia fluida de colaboración remota, similar a Google Docs pero para contenido 3D.

### 🎯 Funcionalidades Principales

#### **🏠 Control de Salas**
Sistema completo de gestión de espacios de trabajo colaborativo donde los usuarios pueden crear salas públicas o privadas (con contraseña), invitar colaboradores, y mantener sesiones de trabajo en equipo. Cada sala mantiene su propio estado independiente y permite al creador actuar como host con permisos especiales.

#### **🔄 Sincronización de Escenas 3D**
Tecnología de sincronización en tiempo real que mantiene todas las escenas 3D perfectamente coordinadas entre todos los participantes. Los cambios realizados por cualquier usuario se propagan instantáneamente a todos los colaboradores, incluyendo transformaciones de objetos, modificaciones de la escena, y actualizaciones del viewport.

#### **🎨 Gestión de Materiales**
Sistema completo para creación, edición y sincronización de materiales 3D. Permite trabajar con diferentes tipos de materiales (Basic, Phong, Standard, Physical) con propiedades como color, textura, metalness, roughness, y transparencia. Todos los cambios de materiales se sincronizan automáticamente entre usuarios.

#### **📐 Geometrías y Objetos 3D**
Biblioteca extensiva de geometrías primitivas y complejas incluyendo cubos, esferas, cilindros, planos, torus, y formas personalizadas. Los usuarios pueden crear, modificar, duplicar y eliminar objetos 3D con sincronización instantánea de todas las transformaciones y propiedades.

#### **📹 Control de Cámaras**
Sistema de cámaras sincronizado que permite a los usuarios ver y compartir diferentes perspectivas de la escena. Incluye controles de órbita, zoom, pan, y diferentes modos de vista (perspectiva, ortográfica) con la posibilidad de seguir la cámara de otros colaboradores.

#### **⚙️ Sistema de Scripts**
Editor de código integrado que permite agregar comportamientos dinámicos y lógica personalizada a los objetos 3D. Los scripts se pueden escribir en JavaScript y se ejecutan en tiempo real, con sincronización de código entre todos los usuarios de la sala.

#### **📂 Gestión de Proyectos**
Funcionalidades para guardar, cargar, exportar e importar proyectos completos. Soporte para múltiples formatos de archivo y la capacidad de compartir proyectos entre diferentes sesiones de trabajo colaborativo.

#### **👥 Colaboración en Tiempo Real**
Indicadores visuales de presencia de usuarios, cursores de colaboradores, historial de cambios, y sistema de notificaciones en vivo. Los usuarios pueden ver quién está editando qué elemento en tiempo real y recibir actualizaciones instantáneas de todas las actividades.

### 🛠️ Stack Tecnológico Completo

#### **Frontend (Cliente)**
- **Three.js**: Motor de renderizado 3D WebGL para manipulación de escenas, objetos, materiales y geometrías
- **Vite**: Build tool moderno con Hot Module Replacement (HMR) para desarrollo rápido
- **ES6 Modules**: Arquitectura modular nativa del navegador
- **WebGL**: Renderizado acelerado por hardware
- **Socket.IO Client**: Comunicación en tiempo real bidireccional
- **Progressive Web App (PWA)**: Service Workers para funcionamiento offline y caching

#### **Backend (Servidor)**
- **Node.js**: Runtime de JavaScript server-side con arquitectura asíncrona
- **Express.js**: Framework web minimalista para APIs REST
- **Socket.IO**: Biblioteca de WebSockets con fallback automático a Long Polling
- **Managers Pattern**: Arquitectura modular (RoomManager, UserManager, EditorManager)
- **Event-Driven Architecture**: Sistema de eventos para sincronización en tiempo real

#### **DevOps & Infraestructura**
- **Docker**: Containerización completa con multi-stage builds
- **Docker Compose**: Orquestación de servicios para desarrollo y producción
- **GitHub Actions**: CI/CD automatizado con pipelines de testing, build y deploy
- **AWS EC2**: Instancia Ubuntu Server en la nube para hosting de producción

#### **Base de Datos & Caching**
- **Redis**: Store in-memory para sesiones, caching y pub/sub messaging
- **Redis Cluster**: Configuración de alta disponibilidad para failover
- **In-Memory Storage**: Gestión de estado temporal para salas y usuarios

#### **Monitoring & Observabilidad**
- **Health Checks**: Endpoints de monitoreo de salud del sistema
- **Logging**: Sistema de logs estructurados con niveles (info, warn, error)
- **Metrics Collection**: Recolección de métricas de rendimiento en tiempo real
- **Error Tracking**: Manejo centralizado de errores y excepciones

### 🌐 Arquitectura de Despliegue en AWS

La aplicación está desplegada en **Amazon Web Services (AWS)** utilizando una instancia **EC2** con **Ubuntu Server 22.04 LTS**, aprovechando la infraestructura elástica de la nube para escalabilidad y disponibilidad:

#### **Configuración de Producción**
```
┌─────────────────────────────────────────────────────────┐
│                    AWS CLOUD INFRASTRUCTURE              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              INTERNET GATEWAY                   │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │              APPLICATION LOAD BALANCER          │   │
│  │                   (SSL/TLS)                     │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │                EC2 INSTANCE                     │   │
│  │            Ubuntu Server 22.04 LTS             │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │           DOCKER CONTAINERS             │   │   │
│  │  │                                         │   │   │
│  │  │ ┌─────────────┐ ┌─────────────────┐   │   │   │
│  │  │ │THRELINKER   │ │     REDIS       │   │   │   │
│  │  │ │APP SERVER   │ │     CACHE       │   │   │   │
│  │  │ │   :3001     │ │     :6379       │   │   │   │
│  │  │ └─────────────┘ └─────────────────┘   │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Security Groups: HTTP/HTTPS (80,443), SSH (22)        │
│  Elastic IP: Static public IP address                  │
│  EBS Storage: Persistent block storage for data        │
└─────────────────────────────────────────────────────────┘
```

#### **Pipeline de CI/CD con GitHub Actions**
El proyecto implementa un flujo de **Continuous Integration/Continuous Deployment** completamente automatizado:

1. **Trigger Events**: Push a `main`, Pull Requests, Tags de versión
2. **Testing Pipeline**: Ejecución automática de tests unitarios y de integración
3. **Build Process**: Construcción de imágenes Docker optimizadas
4. **Security Scanning**: Análisis de vulnerabilidades en dependencias
5. **Deploy to AWS**: Despliegue automático a la instancia EC2 via SSH
6. **Health Checks**: Verificación post-deploy de la salud del sistema

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS EC2
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        run: |
          ssh -o StrictHostKeyChecking=no ubuntu@${{ secrets.EC2_HOST }} '
            cd /opt/linker &&
            git pull origin main &&
            docker-compose down &&
            docker-compose build --no-cache &&
            docker-compose up -d &&
            docker system prune -f
          '
```

### 🔧 Containerización con Docker

La aplicación está completamente containerizada usando **Docker** con un enfoque multi-container orquestado por **Docker Compose**:

#### **Arquitectura de Contenedores**
- **App Container**: Aplicación Node.js con todas las dependencias
- **Redis Container**: Cache in-memory y session store
- **Monitoring Container**: Herramientas de observabilidad (opcional)

#### **Beneficios de la Containerización**
- **Portabilidad**: Ejecución consistente en cualquier ambiente (dev, staging, prod)
- **Aislamiento**: Separación de procesos y recursos del sistema host
- **Escalabilidad**: Fácil replicación horizontal de contenedores
- **Versionado**: Control de versiones de todo el stack tecnológico
- **Rollback**: Capacidad de revertir a versiones anteriores rápidamente

## 📋 Índice
- [Arquitectura General](#arquitectura-general)
- [Sistema de Comunicación](#sistema-de-comunicación)
- [Canales y Eventos](#canales-y-eventos)
- [Arquitectura de Failover](#arquitectura-de-failover)
- [Diagramas Técnicos](#diagramas-técnicos)
- [APIs y Endpoints](#apis-y-endpoints)
- [Configuración y Despliegue](#configuración-y-despliegue)

---

## 🏗️ Arquitectura General

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    THRELINKER ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Cliente)                                         │
│  ┌─────────────────┐  ┌──────────────────┐                │
│  │  Three.js       │  │ CollaborationMgr │                │
│  │  Editor         │  │                  │                │
│  │                 │  │ ┌──────────────┐ │                │
│  │ ┌─────────────┐ │  │ │EditorSync    │ │                │
│  │ │ Scene       │ │  │ │              │ │                │
│  │ │ Objects     │ │  │ │ ┌──────────┐ │ │                │
│  │ │ Materials   │ │  │ │ │SyncSenders│ │ │                │
│  │ │ Geometries  │ │  │ │ │SyncHandlers││ │                │
│  │ │ Scripts     │ │  │ │ │UUIDPreserv││ │                │
│  │ └─────────────┘ │  │ │ └──────────┘ │ │                │
│  └─────────────────┘  │ └──────────────┘ │                │
│                       └──────────────────┘                │
│                               │                            │
│                               │ WebSocket/Socket.IO        │
│                               ▼                            │
├─────────────────────────────────────────────────────────────┤
│  Backend (Servidor)                                         │
│  ┌─────────────────┐  ┌──────────────────┐                │
│  │ Express Server  │  │ Socket.IO Server │                │
│  │                 │  │                  │                │
│  │ ┌─────────────┐ │  │ ┌──────────────┐ │                │
│  │ │ API Routes  │ │  │ │ Event        │ │                │
│  │ │ /api/health │ │  │ │ Handlers     │ │                │
│  │ │ /api/stats  │ │  │ │              │ │                │
│  │ └─────────────┘ │  │ │ ┌──────────┐ │ │                │
│  └─────────────────┘  │ │ │RoomHandlr│ │ │                │
│                       │ │ │UserHandlr│ │ │                │
│  ┌─────────────────┐  │ │ │EditorHdlr│ │ │                │
│  │ Managers        │  │ │ └──────────┘ │ │                │
│  │                 │  │ └──────────────┘ │                │
│  │ ┌─────────────┐ │  └──────────────────┘                │
│  │ │RoomManager  │ │                                       │
│  │ │UserManager  │ │  ┌──────────────────┐                │
│  │ │EditorMngr   │ │  │ Redis Cluster    │                │
│  │ └─────────────┘ │  │ (Failover)       │                │
│  └─────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Sistema de Comunicación

### Protocolo de Comunicación
ThreeLinker utiliza **Socket.IO** sobre WebSockets con los siguientes mecanismos:

#### Configuración del Cliente
```javascript
const socket = io(serverUrl, {
  timeout: 60000,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  maxReconnectionAttempts: 10,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000
});
```

#### Configuración del Servidor
```javascript
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 10e6, // 10MB
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  transports: ['websocket', 'polling']
});
```

---

## 📡 Canales y Eventos

#### **Eventos de Salas**

| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `create-room` | C→S | Crear nueva sala de colaboración | `{roomId, userName, password?, editor}` |
| `room-created` | S→C | Confirmación de sala creada | `{roomId, isHost, userCount, hasEditor}` |
| `room-creation-failed` | S→C | Error al crear sala | `{error, code, details}` |
| `join-room` | C→S | Unirse a sala existente | `{roomId, userName, password?}` |
| `joined-room` | S→C | Confirmación de unión exitosa | `{roomId, userCount, hasEditor, isHost}` |
| `join-room-failed` | S→C | Error al unirse | `{error, code, roomId}` |
| `leave-room` | C→S | Salir de sala | `roomId` |
| `left-room` | S→C | Confirmación de salida | `{roomId, success}` |
| `delete-room` | C→S | Eliminar sala (solo host) | `{roomId}` |
| `room-deleted` | S→C | Sala eliminada | `{roomId, hostName}` |
| `delete-room-failed` | S→C | Error al eliminar | `{error, code, roomId}` |
| `get-rooms` | C→S | Solicitar lista de salas | - |
| `rooms-list` | S→ALL | Lista de salas disponibles | `{rooms: Array}` |

#### **Eventos de Usuarios**

| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `connect` | C→S | Conexión inicial | - |
| `disconnect` | C→S | Desconexión | `reason` |
| `user-joined` | S→ROOM | Usuario se unió a sala | `{userId, userName, userCount}` |
| `user-left` | S→ROOM | Usuario salió de sala | `{userId, userName, userCount}` |
| `user-name-change` | C→S | Cambiar nombre de usuario | `{roomId, userName}` |
| `user-name-changed` | S→ROOM | Nombre cambiado | `{userId, userName, oldName}` |
| `users-list` | S→C | Lista de usuarios en sala | `Array<{id, name, joinedAt, role}>` |
| `user-count` | S→C | Contador de usuarios | `number` |

#### **Eventos del Editor**

##### Sincronización Completa
| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `request-editor-sync` | C→S | Solicitar sincronización inicial | `{roomId}` |
| `sync-full-editor` | C→S | Enviar editor completo | `{roomId, editorData, version}` |
| `receive-full-editor` | S→C | Recibir editor completo | `{editorData, version, hostId, lastUpdate, isInitialSync}` |
| `sync-full-editor-success` | S→C | Confirmación de sync exitoso | `{version, timestamp, message}` |
| `sync-full-editor-error` | S→C | Error en sincronización | `{error}` |

##### Objetos 3D
| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `sync-editor-object-update` | C→S | Actualizar objeto individual | `{roomId, objectData, changeType, objectUuid}` |
| `receive-editor-object-update` | S→ROOM | Recibir actualización de objeto | `{objectData, changeType, objectUuid, updatedBy, timestamp}` |
| `sync-editor-object-removal` | C→S | Eliminar objeto | `{roomId, objectUuid}` |
| `receive-editor-object-removal` | S→ROOM | Objeto eliminado | `{objectUuid, updatedBy, timestamp}` |

##### Escena
| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `sync-scene-background-update` | C→S | Actualizar fondo | `{roomId, backgroundData}` |
| `receive-scene-background-update` | S→ROOM | Fondo actualizado | `{backgroundData, updatedBy, timestamp}` |
| `sync-scene-fog-update` | C→S | Actualizar niebla | `{roomId, fogData}` |
| `receive-scene-fog-update` | S→ROOM | Niebla actualizada | `{fogData, updatedBy, timestamp}` |

#### **Eventos de Sistema**

| Evento | Dirección | Descripción | Payload |
|--------|-----------|-------------|---------|
| `editor-sync-error` | S→C | Error general de sincronización | `{error}` |
| `editor-sync-pending` | S→C | Sincronización en progreso | `{message}` |

---

## 🔄 Broadcasting y Distribución

### Patrones de Comunicación

#### 1. **Unicast** (Cliente → Servidor)
```javascript
// Cliente envía evento específico al servidor
socket.emit('create-room', {roomId, userName, password});
```

```
┌─────────────┐                    ┌─────────────┐
│   Client A  │──── create-room ───▶│   Server    │
│ (Emisor)    │                    │             │
└─────────────┘                    └─────────────┘
```

#### 2. **Broadcast a Sala** (Servidor → Todos en Sala menos remitente)
```javascript
// Servidor envía a todos en la sala excepto al emisor original
socket.to(roomId).emit('user-joined', {userId, userName, userCount});
```

```
                    ┌─────────────┐
                    │   Server    │
                    │   Room-1    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client A  │    │   Client B  │    │   Client C  │
│ (Emisor)    │    │(Receptor)   │    │(Receptor)   │
│     ❌      │    │     ✅      │    │     ✅      │
└─────────────┘    └─────────────┘    └─────────────┘
```

#### 3. **Broadcast Global** (Servidor → Todos los Clientes)
```javascript
// Servidor envía a todos los clientes conectados
io.emit('rooms-list', {rooms: activeRooms});
```

```
                    ┌─────────────┐
                    │   Server    │
                    │ (Broadcast) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client A  │    │   Client B  │    │   Client C  │
│   Room-1    │    │   Room-2    │    │  Lobby      │
│     ✅      │    │     ✅      │    │     ✅      │
└─────────────┘    └─────────────┘    └─────────────┘
```

#### 4. **Targeted Unicast** (Servidor → Cliente Específico)
```javascript
// Servidor envía a un cliente específico
socket.emit('joined-room', {roomId, userCount, hasEditor});
```

```
┌─────────────┐                    ┌─────────────┐
│   Server    │─── joined-room ───▶│   Client B  │
│             │                    │ (Específico)│
└─────────────┘                    └─────────────┘
        │
        │ No envía a otros
        ▼
┌─────────────┐    ┌─────────────┐
│   Client A  │    │   Client C  │
│     ❌      │    │     ❌      │
└─────────────┘    └─────────────┘
```

#### 📡 **Flujo de Sincronización en Tiempo Real**
*Ejemplo práctico: Usuario A mueve un cubo*

```
Step 1: Usuario arrastra cubo        Step 2: Detección y envío
┌─────────────┐                     ┌─────────────┐
│  Client A   │ 🎯 drag cube       │ Collaboration│
│             │ ──────────────────▶ │  Manager    │
│ [🟦]→[🟦]   │                     │             │
└─────────────┘                     └──────┬──────┘
                                           │
                                           │ sync-object-update
                                           ▼
Step 3: Servidor procesa              ┌─────────────┐
┌─────────────┐                      │   Server    │
│ Validation  │ ◀────────────────────│             │
│ & Storage   │                      │ ┌─────────┐ │
└─────────────┘                      │ │ Editor  │ │
                                     │ │Manager  │ │
                                     │ └─────────┘ │
                                     └──────┬──────┘
                                           │
Step 4: Broadcast a sala                   │ receive-object-update
                                           ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Client A   │    │  Client B   │    │  Client C   │
│ (Original)  │    │             │    │             │
│    [🟦]     │    │  [🟦]→[🟦]  │    │  [🟦]→[🟦]  │
│     ❌      │    │     ✅      │    │     ✅      │
└─────────────┘    └─────────────┘    └─────────────┘

Resultado: Sincronización instantánea - Todos ven el cubo en nueva posición
```

### Gestión de Salas (Rooms)

#### Estructura de Salas
```javascript
{
  roomId: string,
  hostId: string,
  hostName: string,
  password: string | null,
  users: Map<socketId, userData>,
  createdAt: timestamp,
  lastActivity: timestamp,
  isProtected: boolean
}
```

#### Gestión de Usuarios por Sala
```javascript
// Unir usuario a sala
socket.join(roomId);

// Enviar a todos en la sala
io.to(roomId).emit(event, data);

// Enviar a todos excepto emisor
socket.to(roomId).emit(event, data);

// Salir de sala
socket.leave(roomId);
```

---

## 📊 Diagramas Técnicos

### 🏗️ **Diagrama de Arquitectura de Canales**
```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           THRELINKER CHANNEL ARCHITECTURE                     │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Frontend Clients                          Backend Server                     │
│  ┌─────────────────┐                      ┌─────────────────┐               │
│  │   Client A      │                      │   Socket.IO     │               │
│  │ ┌─────────────┐ │   ╔══════════════╗   │   Server        │               │
│  │ │Collaboration│ │───║   WebSocket  ║───│ ┌─────────────┐ │               │
│  │ │Manager      │ │   ║   Connection ║   │ │Event        │ │               │
│  │ └─────────────┘ │   ╚══════════════╝   │ │Handlers     │ │               │
│  └─────────────────┘                      │ │             │ │               │
│                                           │ │┌───────────┐│ │               │
│  ┌─────────────────┐                      │ ││Room       ││ │               │
│  │   Client B      │   ╔══════════════╗   │ ││Handler    ││ │               │
│  │ ┌─────────────┐ │───║   WebSocket  ║───│ │└───────────┘│ │               │
│  │ │Collaboration│ │   ║   Connection ║   │ │┌───────────┐│ │               │
│  │ │Manager      │ │   ╚══════════════╝   │ ││User       ││ │               │
│  │ └─────────────┘ │                      │ ││Handler    ││ │               │
│  └─────────────────┘                      │ │└───────────┘│ │               │
│                                           │ │┌───────────┐│ │               │
│  ┌─────────────────┐                      │ ││Editor     ││ │               │
│  │   Client C      │   ╔══════════════╗   │ ││Handler    ││ │               │
│  │ ┌─────────────┐ │───║   WebSocket  ║───│ │└───────────┘│ │               │
│  │ │Collaboration│ │   ║   Connection ║   │ └─────────────┘ │               │
│  │ │Manager      │ │   ╚══════════════╝   └─────────────────┘               │
│  │ └─────────────┘ │                                                        │
│  └─────────────────┘                                                        │
│                                                                               │
│  Channel Types:                          Distribution Patterns:              │
│  • Room Events (🏠)                      • Unicast: Client ──▶ Server       │
│  • User Events (👥)                      • Room Broadcast: Server ──▶ Room  │
│  • Editor Events (🎨)                    • Global Broadcast: Server ──▶ All │
│  • System Events (⚡)                    • Targeted: Server ──▶ Client      │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 🔄 **Diagrama de Flujo de Eventos por Sala**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ROOM EVENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│    Room Creation                Room Join                   Editor Sync         │
│                                                                                 │
│ ┌─────────────┐             ┌─────────────┐             ┌─────────────┐       │
│ │  Client A   │             │  Client B   │             │  Client C   │       │
│ │  (Creator)  │             │  (Joiner)   │             │ (Editor)    │       │
│ └──────┬──────┘             └──────┬──────┘             └──────┬──────┘       │
│        │                           │                           │               │
│        │ create-room               │                           │               │
│        │────────────┐              │                           │               │
│        │            ▼              │                           │               │
│        │      ┌─────────────┐      │ join-room                 │               │
│        │      │   Server    │      │─────────┐                 │               │
│        │      │             │      │         ▼                 │               │
│        │      │ ┌─────────┐ │ ◀────┘   ┌─────────────┐         │               │
│        │      │ │ Room    │ │          │   Server    │         │               │
│        │      │ │Manager  │ │          │             │         │               │
│        │      │ └─────────┘ │          │ ┌─────────┐ │         │               │
│        │      └─────────────┘          │ │ Room    │ │         │               │
│        │            │                  │ │Manager  │ │         │               │
│        │ room-created                  │ └─────────┘ │         │               │
│        │ ◀───────────┘                  └─────────────┘         │               │
│        │                                      │                 │               │
│        │                               joined-room              │               │
│        │                               ────────────▶            │               │
│        │                                      │                 │               │
│        │ user-joined                          │                 │ sync-object   │
│        │ ◀───────────────────────────────────┘                 │ ──────────┐   │
│        │                                                        │           ▼   │
│        │                                                        │     ┌─────────│
│        │                                                        │     │ Server  │
│        │                                                        │     │         │
│        │ receive-object-update                                  │     │ Editor  │
│        │ ◀──────────────────────────────────────────────────────│─────│ Handler │
│        │                                                              └─────────│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 🎭 **Diagrama de Estados de Usuario**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER STATE DIAGRAM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    ┌─────────────┐     connect      ┌─────────────┐                    │
│    │ DISCONNECTED├─────────────────▶│  CONNECTED  │                    │
│    │             │                  │   (Lobby)   │                    │
│    └──────┬──────┘                  └──────┬──────┘                    │
│           ▲                                │                            │
│           │                                │ create-room                │
│           │                                │     OR                     │
│           │                                │ join-room                  │
│           │                                ▼                            │
│           │                         ┌─────────────┐                    │
│           │                         │  IN_ROOM    │                    │
│           │          disconnect     │ (Collaborating)                   │
│           │        ┌────────────────┤             │                    │
│           │        │                │ ┌─────────┐ │                    │
│           │        │                │ │ HOST    │ │                    │
│           │        │                │ │(Creator)│ │                    │
│           │        │                │ └─────────┘ │                    │
│           │        │                │ ┌─────────┐ │                    │
│           │        │                │ │ MEMBER  │ │                    │
│           │        │                │ │(Joiner) │ │                    │
│           │        │                │ └─────────┘ │                    │
│           │        │                └──────┬──────┘                    │
│           │        │                       │                            │
│           │        │                       │ leave-room                 │
│           │        │                       ▼                            │
│           │        │                ┌─────────────┐                    │
│           │        └───────────────▶│  CONNECTED  │                    │
│           │                         │   (Lobby)   │                    │
│           │                         └─────────────┘                    │
│           │                                │                            │
│           │ disconnect                     │ disconnect                 │
│           └────────────────────────────────┘                            │
│                                                                         │
│   Event Triggers:                                                      │
│   • connect → CONNECTED                                                 │
│   • create-room/join-room → IN_ROOM                                    │
│   • leave-room → CONNECTED                                             │
│   • disconnect → DISCONNECTED                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🌊 **Diagrama de Flujo de Datos en Tiempo Real**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME DATA FLOW DIAGRAM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Client Side                   Network Layer              Server Side           │
│                                                                                 │
│ ┌─────────────┐               ┌─────────────┐            ┌─────────────┐       │
│ │Three.js     │               │ Socket.IO   │            │ Event       │       │
│ │Editor       │               │ Transport   │            │ Router      │       │
│ │             │               │             │            │             │       │
│ │ ┌─────────┐ │  JSON Data    │ ┌─────────┐ │ WebSocket  │ ┌─────────┐ │       │
│ │ │Object   │ │──────────────▶│ │Emit     │ │───────────▶│ │Handler  │ │       │
│ │ │Change   │ │               │ │Buffer   │ │            │ │Registry │ │       │
│ │ └─────────┘ │               │ └─────────┘ │            │ └─────────┘ │       │
│ │             │               │             │            │             │       │
│ │ ┌─────────┐ │  Event Data   │ ┌─────────┐ │ Binary     │ ┌─────────┐ │       │
│ │ │Event    │ │ ◀─────────────│ │Receive  │ │◀───────────│ │Broadcast│ │       │
│ │ │Handler  │ │               │ │Queue    │ │            │ │Engine   │ │       │
│ │ └─────────┘ │               │ └─────────┘ │            │ └─────────┘ │       │
│ └─────────────┘               └─────────────┘            └─────────────┘       │
│        │                             │                          │              │
│        ▼                             ▼                          ▼              │
│ ┌─────────────┐               ┌─────────────┐            ┌─────────────┐       │
│ │Collaboration│               │Error        │            │Room         │       │
│ │UI Update    │               │Handling &   │            │State        │       │
│ │             │               │Reconnection │            │Manager      │       │
│ │ ┌─────────┐ │               │             │            │             │       │
│ │ │Scene    │ │               │ ┌─────────┐ │            │ ┌─────────┐ │       │
│ │ │Renderer │ │               │ │Retry    │ │            │ │Memory   │ │       │
│ │ └─────────┘ │               │ │Logic    │ │            │ │Store    │ │       │
│ │             │               │ └─────────┘ │            │ └─────────┘ │       │
│ │ ┌─────────┐ │               │             │            │             │       │
│ │ │User     │ │               │ ┌─────────┐ │            │ ┌─────────┐ │       │
│ │ │Feedback │ │               │ │Health   │ │            │ │Cleanup  │ │       │
│ │ └─────────┘ │               │ │Monitor  │ │            │ │Service  │ │       │
│ └─────────────┘               │ └─────────┘ │            │ └─────────┘ │       │
│                               └─────────────┘            └─────────────┘       │
│                                                                                 │
│ Data Types:                   Transport Modes:           Processing:           │
│ • 3D Object Updates           • WebSocket (Primary)      • Event Validation    │
│ • Material Changes            • Long Polling (Fallback) • State Synchronization│
│ • Scene Modifications         • Binary Frames           • Broadcast Distribution│
│ • User Actions                • JSON Messages           • Memory Management    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏥 Arquitectura de Failover con Redis

### Diseño de Alta Disponibilidad

```
┌─────────────────────────────────────────────────────────────┐
│                 FAILOVER ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐              ┌─────────────┐              │
│  │   CLIENT    │              │   CLIENT    │              │
│  │  BROWSER    │              │  BROWSER    │              │
│  └─────────────┘              └─────────────┘              │
│         │                              │                   │
│         └──────────┬───────────────────┘                   │
│                    │                                       │
│                    ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            LOAD BALANCER / NGINX                    │  │
│  │         (Health Check + Round Robin)               │  │
│  └─────────────────────────────────────────────────────┘  │
│                    │                                       │
│         ┌──────────┼──────────┐                           │
│         │          │          │                           │
│         ▼          ▼          ▼                           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐               │
│  │ SERVER 1  │ │ SERVER 2  │ │ SERVER N  │               │
│  │(Primary)  │ │(Secondary)│ │(Standby)  │               │
│  │           │ │           │ │           │               │
│  │Socket.IO  │ │Socket.IO  │ │Socket.IO  │               │
│  │:3001      │ │:3002      │ │:300N      │               │
│  └───────────┘ └───────────┘ └───────────┘               │
│         │          │          │                           │
│         └──────────┼──────────┘                           │
│                    │                                       │
│                    ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              REDIS CLUSTER                          │  │
│  │                                                     │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │  │
│  │  │Redis Master │ │Redis Replica│ │Redis Replica│   │  │
│  │  │   :6379     │ │   :6380     │ │   :6381     │   │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │  │
│  │                                                     │  │
│  │  • Session Storage      • Room State               │  │
│  │  • User Management      • Editor Synchronization   │  │
│  │  • Pub/Sub Messaging   • Failover Coordination    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Componentes del Sistema de Failover

#### 1. **Load Balancer (NGINX)**
```nginx
upstream threelin_backend {
    server server1:3001 max_fails=3 fail_timeout=30s;
    server server2:3002 max_fails=3 fail_timeout=30s backup;
    server server3:3003 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 80;
    server_name linker.com;
    
    location /socket.io/ {
        proxy_pass http://threelin_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 2. **Redis Adapter para Socket.IO**
```javascript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// Cliente Redis para Publisher
const pubClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Cliente Redis para Subscriber  
const subClient = pubClient.duplicate();

// Configurar adapter
io.adapter(createAdapter(pubClient, subClient));
```

#### 3. **Gestión de Estado Distribuido**
```javascript
class DistributedRoomManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.localRooms = new Map();
    this.serverId = process.env.SERVER_ID || 'server-1';
  }

  async createRoom(roomId, hostId, hostName, password) {
    const roomData = {
      roomId,
      hostId,
      hostName,
      password: password ? await bcrypt.hash(password, 10) : null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      serverId: this.serverId,
      users: {}
    };

    // Guardar en Redis con TTL
    await this.redis.setex(
      `room:${roomId}`, 
      3600, // 1 hora TTL
      JSON.stringify(roomData)
    );

    // Notificar a otros servidores
    await this.redis.publish('room:created', JSON.stringify({
      roomId,
      serverId: this.serverId,
      timestamp: Date.now()
    }));

    this.localRooms.set(roomId, roomData);
    return roomData;
  }

  async addUserToRoom(roomId, userId, userData) {
    const roomKey = `room:${roomId}`;
    const roomData = await this.redis.get(roomKey);
    
    if (!roomData) {
      throw new Error('Room not found');
    }

    const room = JSON.parse(roomData);
    room.users[userId] = {
      ...userData,
      joinedAt: Date.now(),
      serverId: this.serverId
    };
    room.lastActivity = Date.now();

    // Actualizar en Redis
    await this.redis.setex(roomKey, 3600, JSON.stringify(room));

    // Notificar cambio
    await this.redis.publish('room:user-joined', JSON.stringify({
      roomId,
      userId,
      userData,
      serverId: this.serverId
    }));

    return userData;
  }

  // Escuchar eventos de otros servidores
  setupRedisSubscriptions() {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe('room:created', 'room:deleted', 'room:user-joined', 'room:user-left');
    
    subscriber.on('message', async (channel, message) => {
      const data = JSON.parse(message);
      
      // No procesar nuestros propios eventos
      if (data.serverId === this.serverId) return;

      switch(channel) {
        case 'room:created':
          await this.handleRemoteRoomCreated(data);
          break;
        case 'room:user-joined':
          await this.handleRemoteUserJoined(data);
          break;
        // ... otros casos
      }
    });
  }
}
```

#### 4. **Health Monitoring y Failover Detection**
```javascript
class HealthMonitor {
  constructor(io, redisClient) {
    this.io = io;
    this.redis = redisClient;
    this.serverId = process.env.SERVER_ID;
    this.isHealthy = true;
    this.lastHeartbeat = Date.now();
  }

  startMonitoring() {
    // Enviar heartbeat cada 10 segundos
    setInterval(() => {
      this.sendHeartbeat();
    }, 10000);

    // Verificar salud de otros servidores cada 30 segundos
    setInterval(() => {
      this.checkServerHealth();
    }, 30000);

    // Cleanup de servidores muertos cada 2 minutos
    setInterval(() => {
      this.cleanupDeadServers();
    }, 120000);
  }

  async sendHeartbeat() {
    const heartbeat = {
      serverId: this.serverId,
      timestamp: Date.now(),
      connections: this.io.sockets.sockets.size,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    await this.redis.setex(
      `server:heartbeat:${this.serverId}`,
      60, // 1 minuto TTL
      JSON.stringify(heartbeat)
    );
  }

  async checkServerHealth() {
    const serverKeys = await this.redis.keys('server:heartbeat:*');
    
    for (const key of serverKeys) {
      const heartbeatData = await this.redis.get(key);
      if (!heartbeatData) continue;

      const heartbeat = JSON.parse(heartbeatData);
      const timeDiff = Date.now() - heartbeat.timestamp;

      // Si no hay heartbeat en 60 segundos, servidor está muerto
      if (timeDiff > 60000) {
        await this.handleServerFailure(heartbeat.serverId);
      }
    }
  }

  async handleServerFailure(deadServerId) {
    console.log(`Detected server failure: ${deadServerId}`);

    // Migrar salas del servidor muerto
    const rooms = await this.redis.keys(`room:*`);
    
    for (const roomKey of rooms) {
      const roomData = await this.redis.get(roomKey);
      if (!roomData) continue;

      const room = JSON.parse(roomData);
      
      // Si el servidor muerto era el host de la sala
      if (room.serverId === deadServerId) {
        await this.migrateRoom(room);
      }

      // Migrar usuarios del servidor muerto
      for (const [userId, userData] of Object.entries(room.users)) {
        if (userData.serverId === deadServerId) {
          await this.migrateUser(roomKey, userId, userData);
        }
      }
    }
  }

  async migrateRoom(room) {
    // Transferir ownership de la sala a este servidor
    room.serverId = this.serverId;
    room.lastActivity = Date.now();

    await this.redis.setex(
      `room:${room.roomId}`,
      3600,
      JSON.stringify(room)
    );

    // Notificar migración
    await this.redis.publish('room:migrated', JSON.stringify({
      roomId: room.roomId,
      fromServer: room.serverId,
      toServer: this.serverId,
      timestamp: Date.now()
    }));
  }
}
```

#### 5. **Sticky Sessions con Redis**
```javascript
class SessionManager {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async createSession(socketId, userData) {
    const session = {
      socketId,
      userId: userData.id,
      userName: userData.name,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      serverId: process.env.SERVER_ID,
      currentRoom: null
    };

    await this.redis.setex(
      `session:${socketId}`,
      86400, // 24 horas
      JSON.stringify(session)
    );

    return session;
  }

  async updateSession(socketId, updates) {
    const sessionData = await this.redis.get(`session:${socketId}`);
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);
    Object.assign(session, updates, { lastSeen: Date.now() });

    await this.redis.setex(
      `session:${socketId}`,
      86400,
      JSON.stringify(session)
    );

    return session;
  }

  async getSession(socketId) {
    const sessionData = await this.redis.get(`session:${socketId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async deleteSession(socketId) {
    await this.redis.del(`session:${socketId}`);
  }

  // Migrar sesiones en caso de failover
  async migrateSessions(fromServerId, toServerId) {
    const sessionKeys = await this.redis.keys('session:*');
    
    for (const key of sessionKeys) {
      const sessionData = await this.redis.get(key);
      if (!sessionData) continue;

      const session = JSON.parse(sessionData);
      if (session.serverId === fromServerId) {
        session.serverId = toServerId;
        session.migratedAt = Date.now();
        
        await this.redis.setex(key, 86400, JSON.stringify(session));
      }
    }
  }
}
```

### Configuración Docker Compose para Failover

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - server1
      - server2

  server1:
    build: .
    environment:
      - NODE_ENV=production
      - SERVER_ID=server-1
      - PORT=3001
      - REDIS_HOST=redis-master
      - REDIS_PORT=6379
    depends_on:
      - redis-master
    restart: unless-stopped

  server2:
    build: .
    environment:
      - NODE_ENV=production
      - SERVER_ID=server-2
      - PORT=3001
      - REDIS_HOST=redis-master
      - REDIS_PORT=6379
    depends_on:
      - redis-master
    restart: unless-stopped

  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --replica-read-only no
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  redis-replica1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master
    restart: unless-stopped

  redis-replica2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master
    restart: unless-stopped

  redis-sentinel1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master

volumes:
  redis-data:
```

---

## 📊 APIs y Endpoints

### REST API Endpoints

#### Health Check
```
GET /api/health
Response: {
  status: "healthy" | "unhealthy",
  timestamp: number,
  uptime: number,
  connections: number,
  rooms: number,
  users: number
}
```

#### Server Statistics
```
GET /api/stats
Response: {
  health: HealthStatus,
  rooms: RoomStats,
  users: UserStats,
  editors: EditorStats,
  activeRooms: number,
  timestamp: number
}
```

### Diagramas de Flujo de Canales

#### 🔌 **Flujo de Conexión Inicial**
```
┌─────────────┐                           ┌─────────────┐
│   Client    │                           │   Server    │
└──────┬──────┘                           └──────┬──────┘
       │                                         │
       │────────── connect ────────────────────▶ │
       │                                         │
       │ ◀────────── 'connect' ──────────────────│
       │                                         │
       │────────── get-rooms ──────────────────▶ │
       │                                         │
       │ ◀────────── rooms-list ──────────────── │
       │                                         │
       │                                         │
```

#### 🏠 **Flujo de Creación de Sala**
```
┌─────────────┐                           ┌─────────────┐                           ┌─────────────┐
│  Client A   │                           │   Server    │                           │ All Clients │
│  (Creator)  │                           │             │                           │             │
└──────┬──────┘                           └──────┬──────┘                           └──────┬──────┘
       │                                         │                                         │
       │────── create-room ───────────────────▶  │                                         │
       │       {roomId, userName, password}      │                                         │
       │                                         │                                         │
       │ ◀────── room-created ────────────────── │                                         │
       │         {roomId, isHost: true}          │                                         │
       │                                         │                                         │
       │                                         │ ────── rooms-list ──────────────────▶  │
       │                                         │        {rooms: [...newRoom]}           │
       │                                         │                                         │
```

#### 👥 **Flujo de Unión a Sala**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Client A   │    │   Server    │    │  Client B   │    │ Room Members│
│ (Existing)  │    │             │    │ (Joining)   │    │             │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │                  │ ◀── join-room ───│                  │
       │                  │    {roomId, userName}               │
       │                  │                  │                  │
       │                  │ ──── joined-room ──▶                │
       │                  │      {roomId, userCount}            │
       │                  │                  │                  │
       │ ◀─── user-joined ─│                  │                  │
       │      {userId, userName}              │                  │
       │                  │                  │                  │
       │                  │ ────────────── user-joined ──────▶  │
       │                  │                {userId, userName}    │
       │                  │                  │                  │
       │                  │ ── receive-full-editor ────────────▶ │
       │                  │    {editorData} (if exists)         │
```

#### 🎨 **Flujo de Sincronización del Editor**
```
┌─────────────┐              ┌─────────────┐              ┌─────────────┐
│  Client A   │              │   Server    │              │ Room Members│
│ (Editor)    │              │             │              │ (Receivers) │
└──────┬──────┘              └──────┬──────┘              └──────┬──────┘
       │                            │                            │
       │── sync-full-editor ──────▶  │                            │
       │   {roomId, editorData}      │                            │
       │                            │                            │
       │ ◀── sync-full-editor-success │                            │
       │                            │                            │
       │                            │ ── receive-full-editor ──▶ │
       │                            │    {editorData, hostId}    │
       │                            │                            │
       │                            │                            │
       │── sync-object-update ────▶  │                            │
       │   {roomId, objectData}      │                            │
       │                            │                            │
       │                            │ ── receive-object-update ▶ │
       │                            │    {objectData, updatedBy} │
```

#### 🔄 **Flujo de Broadcasting Múltiple**
```
                              ┌─────────────┐
                              │   Server    │
                              │             │
                              └──────┬──────┘
                                     │
    ┌─ rooms-list (Global) ──────────┼─────────────── rooms-list ─┐
    │                                │                             │
    ▼                                │                             ▼
┌─────────┐                         │                        ┌─────────┐
│Client A │                         │                        │Client C │
│ Room-1  │                         │                        │ Lobby   │
└─────────┘                         │                        └─────────┘
                                    │
                                    │ user-joined (Room-1 only)
                                    │
                                    ▼
                               ┌─────────┐
                               │Client B │
                               │ Room-1  │
                               └─────────┘
```

#### 📊 **Matriz de Distribución de Eventos**

| Evento | Unicast | Room Broadcast | Global Broadcast | Targeted |
|--------|---------|----------------|------------------|----------|
| `connect` | ✅ | ❌ | ❌ | ❌ |
| `create-room` | ✅ | ❌ | ❌ | ❌ |
| `room-created` | ❌ | ❌ | ❌ | ✅ |
| `rooms-list` | ❌ | ❌ | ✅ | ❌ |
| `join-room` | ✅ | ❌ | ❌ | ❌ |
| `joined-room` | ❌ | ❌ | ❌ | ✅ |
| `user-joined` | ❌ | ✅ | ❌ | ❌ |
| `user-left` | ❌ | ✅ | ❌ | ❌ |
| `sync-full-editor` | ✅ | ❌ | ❌ | ❌ |
| `receive-full-editor` | ❌ | ✅ | ❌ | ❌ |
| `sync-object-update` | ✅ | ❌ | ❌ | ❌ |
| `receive-object-update` | ❌ | ✅ | ❌ | ❌ |
| `disconnect` | ✅ | ❌ | ❌ | ❌ |

#### 🌐 **Diagrama de Estado de Conexiones**
```
  ┌─────────────────┐
  │   DESCONECTADO  │
  └────────┬────────┘
           │ connect
           ▼
  ┌─────────────────┐
  │    CONECTADO    │ ◀──────┐
  │   (En Lobby)    │        │ leave-room
  └────────┬────────┘        │
           │ join-room       │
           ▼                 │
  ┌─────────────────┐        │
  │   EN SALA       │────────┘
  │ (Colaborando)   │
  └────────┬────────┘
           │ disconnect
           ▼
  ┌─────────────────┐
  │   DESCONECTADO  │
  └─────────────────┘
```

---

## 🔧 Configuración y Despliegue

### Variables de Entorno

#### Servidor
```bash
# Server Configuration
NODE_ENV=production
PORT=3001
SERVER_ID=server-1

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Socket.IO Configuration
SOCKET_TIMEOUT=60000
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# Cors Configuration
CORS_ORIGIN=*
CORS_METHODS=GET,POST

# Monitoring
HEALTH_CHECK_INTERVAL=30000
CLEANUP_INTERVAL=300000
```

#### Cliente
```bash
# Development
VITE_SERVER_URL=http://localhost:3001

# Production
VITE_SERVER_URL=https://api.linker.com
```

### Scripts de Despliegue

#### Desarrollo
```bash
# Servidor de desarrollo
npm run dev

# Servidor de colaboración
npm run server

# Desarrollo completo (ambos)
npm run dev:full
```

#### Producción
```bash
# Build del cliente
npm run build

# Inicio del servidor
npm start

# Docker
docker-compose up -d

# Con failover
docker-compose -f docker-compose.failover.yml up -d
```

### Monitoreo y Logging

#### Health Checks
```javascript
// Endpoint de salud personalizado
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: io.sockets.sockets.size,
    rooms: roomManager.getStats().totalRooms,
    users: userManager.getStats().totalUsers
  };
  
  res.json(health);
});
```

#### Métricas de Rendimiento
```javascript
// Métricas en tiempo real
setInterval(() => {
  const metrics = {
    timestamp: Date.now(),
    connections: io.sockets.sockets.size,
    rooms: roomManager.getActiveRooms().length,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    events_per_second: eventCounter.getRate()
  };
  
  // Enviar a sistema de monitoreo
  metricsCollector.record(metrics);
}, 10000);
```

---

## 🛡️ Seguridad y Autenticación

### Autenticación de Salas
- **Salas públicas**: Acceso libre sin contraseña
- **Salas privadas**: Protegidas con contraseña hasheada (bcrypt)
- **Validación de entrada**: Sanitización de nombres de usuario y IDs de sala
- **Rate limiting**: Prevención de spam de eventos

### Validación de Datos
```javascript
// Validación de creación de sala
function validateRoomCreationData(data) {
  const errors = [];
  
  if (!data.roomId || typeof data.roomId !== 'string') {
    errors.push('ID de sala requerido');
  }
  
  if (data.roomId.length < 3 || data.roomId.length > 50) {
    errors.push('ID de sala debe tener entre 3 y 50 caracteres');
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(data.roomId)) {
    errors.push('ID de sala contiene caracteres inválidos');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## 📈 Escalabilidad y Optimización

### Optimizaciones de Rendimiento
- **Throttling**: Limitación de frecuencia de sincronización (500ms)
- **Batching**: Agrupación de eventos similares
- **Compression**: Compresión de datos del editor antes del envío
- **Cleanup automático**: Limpieza de recursos cada 5 minutos

### Límites del Sistema
```javascript
const LIMITS = {
  MAX_USERS_PER_ROOM: 50,
  MAX_ROOMS_PER_SERVER: 1000,
  MAX_OBJECT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_SYNC_FREQUENCY: 500, // ms
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas
  ROOM_CLEANUP_INTERVAL: 5 * 60 * 1000 // 5 minutos
};
```

---

Esta documentación técnica proporciona una guía completa para entender, desarrollar y desplegar el sistema ThreeLinker con capacidades de alta disponibilidad y failover automático.
