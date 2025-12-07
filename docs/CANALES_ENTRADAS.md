# ThreeLinker - Tabla de Entradas de Canales

## Entradas del Sistema (Cliente → Servidor)

### **Eventos de Gestión de Salas**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `create-room` | Solicitud para crear una nueva sala de colaboración 3D con configuración específica | `{roomId, userName, password?, editor}` |
| `join-room` | Petición para unirse a una sala existente, con autenticación opcional | `{roomId, userName, password?}` |
| `leave-room` | Comando para salir de la sala actual y desconectar de la colaboración | `roomId` |
| `delete-room` | Orden para eliminar completamente una sala (solo disponible para el host) | `{roomId}` |
| `get-rooms` | Solicitud para obtener la lista completa de salas disponibles en el servidor | - |

### **Eventos de Gestión de Usuarios**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `connect` | Evento automático que se dispara cuando un cliente establece conexión WebSocket | - |
| `disconnect` | Evento que se activa cuando un cliente se desconecta del servidor | `reason` |
| `user-name-change` | Solicitud para cambiar el nombre de usuario visible en la sala actual | `{roomId, userName}` |

### **Eventos de Sincronización del Editor**

#### **Sincronización Completa**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `request-editor-sync` | Solicitud para recibir el estado completo del editor de la sala | `{roomId}` |
| `sync-full-editor` | Envío del estado completo del editor 3D con todos los objetos y configuraciones | `{roomId, editorData, version}` |

#### **Objetos 3D**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `sync-editor-object-update` | Actualización de propiedades de un objeto 3D específico (posición, rotación, escala) | `{roomId, objectData, changeType, objectUuid}` |
| `sync-editor-object-removal` | Comando para eliminar un objeto 3D específico de la escena | `{roomId, objectUuid}` |

#### **Materiales y Geometrías**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `sync-editor-material-update` | Modificación de propiedades de material (color, textura, metalness, roughness) | `{roomId, materialData, materialUuid}` |
| `sync-editor-geometry-update` | Cambio en la geometría de un objeto (tamaño, forma, vértices) | `{roomId, geometryData, geometryUuid}` |

#### **Configuración de Escena**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `sync-scene-background-update` | Cambio del fondo de la escena 3D (color, textura, skybox) | `{roomId, backgroundData}` |
| `sync-scene-fog-update` | Modificación de la configuración de niebla en la escena | `{roomId, fogData}` |

#### **Sistema de Scripts**

| Nombre del Evento | Descripción | Payload |
|-------------------|-------------|---------|
| `sync-script-added` | Adición de un nuevo script JavaScript a un objeto 3D específico | `{roomId, objectUuid, script}` |
| `sync-script-changed` | Modificación del código de un script existente en un objeto | `{roomId, objectUuid, script}` |
| `sync-script-removed` | Eliminación de un script de un objeto 3D | `{roomId, objectUuid, script}` |

---

## **Clasificación por Frecuencia de Uso**

### **Alta Frecuencia (> 10 veces/minuto)**
- `sync-editor-object-update` - Movimientos y transformaciones constantes
- `sync-editor-material-update` - Cambios frecuentes de apariencia
- `user-name-change` - Identificación dinámica de usuarios

### **Media Frecuencia (1-10 veces/minuto)**
- `sync-scene-background-update` - Ajustes de ambiente
- `sync-script-changed` - Modificaciones de código
- `join-room` / `leave-room` - Flujo de usuarios

### **Baja Frecuencia (< 1 vez/minuto)**
- `create-room` / `delete-room` - Gestión de espacios de trabajo
- `sync-full-editor` - Sincronizaciones completas
- `get-rooms` - Consultas de estado general

---

## **Nivel de Seguridad Requerido**

### **Autenticación Requerida**
- `delete-room` - Solo el host puede eliminar la sala
- `sync-full-editor` - Verificación de permisos de edición

### **Validación de Datos**
- `create-room` - Validación de formato de roomId y userName
- `join-room` - Verificación de contraseña si la sala es privada
- Todos los eventos de sincronización - Validación de estructura JSON

### **Rate Limiting Aplicado**
- `sync-editor-object-update` - Throttling de 500ms
- `user-name-change` - Limitación de cambios frecuentes
- `get-rooms` - Prevención de spam de consultas