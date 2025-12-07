# ThreeLinker - Tabla de Salidas de Canales

## Salidas del Sistema (Servidor → Cliente/s)

### **Eventos de Respuesta de Salas**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `room-created` | Confirmación de creación exitosa de sala con información del host | Cliente específico | `{roomId, isHost, userCount, hasEditor}` |
| `room-creation-failed` | Notificación de error durante la creación de sala | Cliente específico | `{error, code, details}` |
| `joined-room` | Confirmación de unión exitosa a sala con contexto de la sesión | Cliente específico | `{roomId, userCount, hasEditor, isHost}` |
| `join-room-failed` | Error al intentar unirse a una sala (contraseña incorrecta, sala llena) | Cliente específico | `{error, code, roomId}` |
| `left-room` | Confirmación de salida exitosa de la sala | Cliente específico | `{roomId, success}` |
| `room-deleted` | Notificación de que una sala ha sido eliminada por el host | Todos los clientes | `{roomId, hostName}` |
| `delete-room-failed` | Error al intentar eliminar sala (permisos insuficientes) | Cliente específico | `{error, code, roomId}` |
| `rooms-list` | Lista actualizada de todas las salas disponibles en el servidor | Todos los clientes | `{rooms: Array}` |

### **Eventos de Presencia de Usuarios**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `user-joined` | Notificación de que un nuevo usuario se ha unido a la sala | Usuarios de la sala | `{userId, userName, userCount}` |
| `user-left` | Aviso de que un usuario ha salido de la sala | Usuarios de la sala | `{userId, userName, userCount}` |
| `user-name-changed` | Comunicación de cambio de nombre de usuario en la sala | Usuarios de la sala | `{userId, userName, oldName}` |
| `users-list` | Lista completa de usuarios activos en la sala actual | Cliente específico | `Array<{id, name, joinedAt, role}>` |
| `user-count` | Contador actualizado de usuarios en la sala | Cliente específico | `number` |

### **Eventos de Sincronización del Editor**

#### **Confirmaciones de Sincronización**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `sync-full-editor-success` | Confirmación de que la sincronización completa fue exitosa | Cliente específico | `{version, timestamp, message}` |
| `sync-full-editor-error` | Error durante el proceso de sincronización completa | Cliente específico | `{error}` |
| `editor-sync-error` | Error general en cualquier operación de sincronización | Cliente específico | `{error}` |
| `editor-sync-pending` | Notificación de que hay una sincronización en progreso | Cliente específico | `{message}` |

#### **Distribución de Cambios del Editor**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `receive-full-editor` | Recepción del estado completo del editor con todos los objetos | Usuarios de la sala | `{editorData, version, hostId, lastUpdate, isInitialSync}` |
| `receive-editor-object-update` | Actualización de objeto 3D recibida de otro colaborador | Usuarios de la sala (excepto emisor) | `{objectData, changeType, objectUuid, updatedBy, timestamp}` |
| `receive-editor-object-removal` | Notificación de eliminación de objeto por otro usuario | Usuarios de la sala (excepto emisor) | `{objectUuid, updatedBy, timestamp}` |

#### **Cambios de Materiales y Geometrías**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `receive-editor-material-update` | Actualización de propiedades de material aplicada por otro usuario | Usuarios de la sala (excepto emisor) | `{materialData, materialUuid, updatedBy, timestamp}` |
| `receive-editor-geometry-update` | Modificación de geometría realizada por colaborador | Usuarios de la sala (excepto emisor) | `{geometryData, geometryUuid, updatedBy, timestamp}` |

#### **Cambios de Escena**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `receive-scene-background-update` | Actualización del fondo de escena aplicada por otro usuario | Usuarios de la sala (excepto emisor) | `{backgroundData, updatedBy, timestamp}` |
| `receive-scene-fog-update` | Cambio en configuración de niebla realizado por colaborador | Usuarios de la sala (excepto emisor) | `{fogData, updatedBy, timestamp}` |

#### **Sincronización de Scripts**

| Nombre del Evento | Descripción | Destinatario | Payload |
|-------------------|-------------|--------------|---------|
| `receive-script-added` | Notificación de script agregado por otro usuario | Usuarios de la sala (excepto emisor) | `{objectUuid, script, updatedBy, timestamp}` |
| `receive-script-changed` | Actualización de código de script modificado por colaborador | Usuarios de la sala (excepto emisor) | `{objectUuid, script, updatedBy, timestamp}` |
| `receive-script-removed` | Aviso de eliminación de script por otro usuario | Usuarios de la sala (excepto emisor) | `{objectUuid, script, updatedBy, timestamp}` |

---

## **Patrones de Distribución**

### **Unicast (Servidor → Cliente Específico)**
- `room-created`, `joined-room`, `left-room` - Respuestas directas a acciones
- `sync-full-editor-success`, `editor-sync-error` - Confirmaciones personales
- `users-list`, `user-count` - Información contextual del usuario

### **Room Broadcast (Servidor → Usuarios de Sala, excepto emisor)**
- `receive-editor-object-update` - Cambios de objetos 3D
- `receive-editor-material-update` - Actualizaciones de materiales
- `receive-script-changed` - Modificaciones de código
- `user-joined`, `user-left` - Presencia de usuarios

### **Global Broadcast (Servidor → Todos los Clientes)**
- `rooms-list` - Lista actualizada de salas disponibles
- `room-deleted` - Notificación de eliminación de sala

### **Automatic Events (Eventos del Sistema)**
- Reconnection events - Manejo automático de reconexiones
- Health status updates - Estado de salud del servidor
- Performance metrics - Métricas de rendimiento (opcional)

---

## **Frecuencia de Envío**

### **Tiempo Real (< 100ms)**
- `receive-editor-object-update` - Transformaciones inmediatas
- `user-joined` / `user-left` - Presencia instantánea
- `receive-editor-material-update` - Cambios visuales directos

### **Diferido (100-500ms)**
- `receive-full-editor` - Sincronización completa con throttling
- `receive-scene-background-update` - Cambios de ambiente
- `rooms-list` - Actualizaciones de estado general

### **Bajo Demanda**
- `users-list` - Solo cuando se solicita explícitamente
- Error events - Solo cuando ocurren problemas
- Success confirmations - Solo tras acciones específicas

---

## **Impacto en el Rendimiento**

### **Alto Impacto de Red**
- `receive-full-editor` - Transferencia de datos completos del editor
- `rooms-list` - Lista completa de salas con metadatos

### **Medio Impacto**
- `receive-editor-object-update` - Datos de objetos individuales
- `receive-editor-material-update` - Propiedades de materiales

### **Bajo Impacto**
- `user-joined` / `user-left` - Eventos simples de presencia
- Error/success messages - Mensajes de estado mínimos