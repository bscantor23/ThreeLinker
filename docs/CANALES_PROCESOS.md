# ThreeLinker - Tabla de Procesos de Canales

## Procesos del Sistema (Servidor Interno)

### **Procesos de Gestión de Salas**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Room Creation Validation** | Valida formato de roomId, unicidad, y credenciales del host antes de crear sala | RoomManager, Validator |
| **Room Password Authentication** | Verifica contraseña usando bcrypt hash para salas privadas | RoomManager, bcrypt |
| **Room State Management** | Mantiene estado actualizado de usuarios, host, y metadatos de cada sala activa | RoomManager, Memory Store |
| **Room Cleanup Process** | Elimina automáticamente salas vacías o inactivas después del timeout | RoomManager, Scheduler |
| **Host Permission Validation** | Verifica que solo el host puede realizar operaciones privilegiadas como eliminar sala | RoomManager, AuthService |
| **Room Broadcasting** | Distribuye eventos de sala (creación, eliminación) a todos los clientes relevantes | RoomManager, Socket.IO |

### **Procesos de Gestión de Usuarios**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **User Session Creation** | Establece nueva sesión de usuario con identificador único y metadatos | UserManager, SessionStore |
| **User Presence Tracking** | Monitorea estado activo/inactivo de usuarios y detecta desconexiones | UserManager, Heartbeat Monitor |
| **Username Validation** | Verifica que el nombre de usuario sea válido y único dentro de la sala | UserManager, Validator |
| **User Room Assignment** | Asocia usuarios con salas específicas y gestiona la membresía | UserManager, RoomManager |
| **User Cleanup Service** | Remueve usuarios inactivos y limpia referencias de memoria | UserManager, Scheduler |
| **User Count Management** | Mantiene contadores precisos de usuarios por sala y globalmente | UserManager, Counter Service |

### **Procesos de Sincronización del Editor**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Editor State Validation** | Verifica integridad y estructura de datos del editor 3D antes de almacenar | EditorManager, JSONValidator |
| **Object Serialization** | Convierte objetos Three.js a formato JSON transportable y viceversa | EditorManager, Serializer |
| **UUID Preservation** | Mantiene identificadores únicos consistentes para objetos entre sesiones | EditorManager, UUID Service |
| **Full Editor Sync Process** | Sincroniza estado completo del editor para nuevos usuarios o reconexiones | EditorManager, Compressor |
| **Incremental Update Processing** | Procesa y distribuye cambios individuales de objetos, materiales, o escena | EditorManager, Delta Processor |
| **Editor Version Management** | Gestiona versiones del estado del editor para detección de conflictos | EditorManager, Version Control |
| **Scene Integrity Check** | Valida que la estructura de la escena 3D sea coherente y renderizable | EditorManager, Scene Validator |

### **Procesos de Comunicación y Red**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Event Routing** | Determina destinatarios correctos para cada evento (unicast, broadcast, room) | Event Router, Socket.IO |
| **Message Serialization** | Convierte objetos JavaScript a JSON y maneja compresión de datos grandes | Message Processor, Compressor |
| **Connection Health Monitoring** | Supervisa salud de conexiones WebSocket y maneja reconexiones | Health Monitor, Socket.IO |
| **Event Throttling** | Limita frecuencia de eventos para prevenir spam y optimizar rendimiento | Throttle Service, Rate Limiter |
| **Room Broadcasting Logic** | Distribuye eventos a todos los usuarios de una sala excepto el emisor | Room Broadcaster, Socket.IO |
| **Error Handling Process** | Captura, logs y notifica errores de comunicación a clientes relevantes | Error Handler, Logger |

### **Procesos de Sincronización en Tiempo Real**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Conflict Resolution** | Resuelve conflictos cuando múltiples usuarios editan el mismo objeto simultáneamente | Conflict Resolver, EditorManager |
| **State Reconciliation** | Sincroniza estado entre cliente y servidor tras reconexiones o desincronización | State Reconciler, EditorManager |
| **Change Detection** | Detecta y categoriza tipos de cambios en objetos 3D, materiales, y escena | Change Detector, Delta Calculator |
| **Broadcast Optimization** | Optimiza distribución de eventos agrupando cambios similares | Broadcast Optimizer, Batcher |
| **Real-time Validation** | Valida cambios en tiempo real antes de aplicarlos y distribuirlos | Real-time Validator, Schema Checker |

### **Procesos de Gestión de Estado**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Memory State Management** | Gestiona almacenamiento en memoria de salas, usuarios y estado del editor | Memory Manager, Data Structures |
| **State Persistence** | Almacena temporalmente estado crítico para recuperación en caso de fallos | Persistence Layer, Memory Store |
| **Cache Management** | Optimiza acceso a datos frecuentemente utilizados con sistema de caché | Cache Manager, LRU Cache |
| **State Cleanup Process** | Limpia estado obsoleto y libera memoria de recursos no utilizados | Cleanup Service, Garbage Collector |
| **Backup State Creation** | Crea copias de respaldo del estado crítico para recuperación rápida | Backup Service, State Snapshots |

### **Procesos de Seguridad y Validación**

| Nombre del Proceso | Descripción | Componentes Involucrados |
|-------------------|-------------|---------------------------|
| **Input Sanitization** | Limpia y valida todas las entradas de usuario para prevenir inyecciones | Input Sanitizer, Validator |
| **Permission Verification** | Verifica permisos de usuario para operaciones específicas en salas | Permission Checker, AuthService |
| **Rate Limiting Enforcement** | Aplica límites de frecuencia para prevenir abuse y spam de eventos | Rate Limiter, Throttle Engine |
| **Data Integrity Check** | Valida integridad de datos críticos del editor y detects corrupción | Integrity Checker, Hash Validator |
| **Session Security Management** | Gestiona seguridad de sesiones y tokens de autenticación | Session Manager, Security Service |

---

## **Clasificación por Criticidad**

### **Críticos (Sistema no funciona sin ellos)**
- **Event Routing** - Core de la comunicación
- **User Session Creation** - Base de la colaboración
- **Room State Management** - Fundamento de las salas
- **Editor State Validation** - Integridad de datos 3D

### **Importantes (Afectan rendimiento y experiencia)**
- **Object Serialization** - Eficiencia de transferencia
- **Conflict Resolution** - Calidad de colaboración
- **Connection Health Monitoring** - Estabilidad de conexiones
- **Memory State Management** - Performance del sistema

### **Auxiliares (Optimización y mantenimiento)**
- **Room Cleanup Process** - Mantenimiento automático
- **Cache Management** - Optimización de velocidad
- **Backup State Creation** - Recuperación ante fallos
- **State Cleanup Process** - Eficiencia de memoria

---

## **Optimización de Rendimiento**

### **Procesos Paralelos**
- **User Presence Tracking** + **Connection Health Monitoring** - Ejecutan simultáneamente
- **Event Routing** + **Message Serialization** - Pipeline de procesamiento
- **State Persistence** + **Cache Management** - Gestión de datos paralela

### **Procesos con Throttling**
- **Incremental Update Processing** - Limitado a 500ms entre updates
- **Full Editor Sync Process** - Máximo 1 por segundo por usuario
- **Room Broadcasting Logic** - Agrupación de eventos similares

### **Procesos Asíncronos**
- **Room Cleanup Process** - No bloquea operaciones principales
- **User Cleanup Service** - Ejecuta en background
- **Backup State Creation** - Operación diferida