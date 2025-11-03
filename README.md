# ThreeLinker

ThreeLinker es un editor de Three.js con capacidades de colaboración en tiempo real. Es una versión standalone del editor oficial de Three.js que permite a múltiples usuarios trabajar juntos en escenas 3D de forma simultánea.

## 🌟 Características Principales

### Editor 3D Completo
- **Editor visual interactivo** para crear y editar escenas 3D
- **Viewport en tiempo real** con controles de cámara intuitivos
- **Panel de propiedades** para modificar objetos, materiales y geometrías
- **Sistema de scripts** con editor de código integrado (CodeMirror)
- **Historial de comandos** con funcionalidad de deshacer/rehacer
- **Importación/Exportación** de modelos y escenas

### Geometrías Soportadas
- Geometrías básicas: Box, Sphere, Cylinder, Plane, etc.
- Geometrías avanzadas: Torus, Dodecahedron, Icosahedron, etc.
- Geometrías personalizadas: Extrude, Lathe, Tube, Shape, etc.
- Modificadores de geometría

### Materiales y Shaders
- Materiales estándar de Three.js
- Editor de shaders GLSL integrado
- Sistema de propiedades de materiales
- Soporte para texturas y mapas

### 🤝 Colaboración en Tiempo Real
- **Salas de colaboración** - Crea o únete a salas para trabajar en equipo
- **Sincronización automática** - Todos los cambios se sincronizan instantáneamente
- **Cursores colaborativos** - Ve dónde están trabajando otros usuarios
- **Chat integrado** - Comunícate con tu equipo mientras trabajas
- **Gestión de usuarios** - Sistema de nombres y roles
- **Estados de conexión** - Información visual del estado de la colaboración

## 🚀 Instalación y Uso

### Requisitos Previos
- Node.js (versión 16 o superior)
- npm o yarn

### Instalación

1. Clona el repositorio:
```bash
git clone <tu-repositorio>
cd three-linker
```

2. Instala las dependencias:
```bash
npm install
```

### Modos de Ejecución

#### Modo Solo (Sin Colaboración)
Para usar solo el editor sin funcionalidades de colaboración:
```bash
npm run dev
```
Abre http://localhost:5173 en tu navegador.

#### Modo Colaborativo
Para usar todas las funcionalidades incluyendo colaboración en tiempo real:

1. Inicia el servidor de colaboración:
```bash
npm run server
```

2. En otra terminal, inicia el cliente:
```bash
npm run dev
```

3. O ejecuta ambos simultáneamente:
```bash
npm run dev:full
```

Abre http://localhost:5173 en tu navegador y disfruta de la colaboración en tiempo real.

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Three.js** - Biblioteca principal para gráficos 3D
- **Vite** - Bundler y servidor de desarrollo
- **Socket.IO Client** - Comunicación en tiempo real
- **HTML5/CSS3/JavaScript ES6+**

### Backend
- **Node.js** - Runtime del servidor
- **Express** - Framework web
- **Socket.IO** - WebSockets para tiempo real
- **Sistema de gestión de salas y usuarios**

### Bibliotecas Adicionales
- **three-gpu-pathtracer** - Renderizado avanzado
- **three-mesh-bvh** - Optimización de mallas
- **FFmpeg.js** - Procesamiento de video
- **Signals** - Sistema de eventos

## 📁 Estructura del Proyecto

```
three-linker/
├── js/                         # Código principal del editor
│   ├── Editor.js              # Clase principal del editor
│   ├── Viewport.js            # Viewport 3D
│   ├── Sidebar.js             # Panel lateral
│   ├── Menubar.js             # Barra de menús
│   ├── CollaborationManager.js # Gestión de colaboración
│   ├── CollaborationPanel.js  # Panel de colaboración
│   └── ...                    # Otros módulos
├── server/                     # Servidor de colaboración
│   ├── collaborationServer.js # Configuración principal
│   ├── managers/              # Gestores de salas, usuarios, etc.
│   ├── handlers/              # Manejadores de eventos
│   └── utils/                 # Utilidades del servidor
├── css/                       # Estilos
├── examples/                  # Escenas de ejemplo
├── images/                    # Recursos gráficos
├── index.html                 # Página principal
├── server.js                  # Punto de entrada del servidor
└── package.json              # Configuración del proyecto
```

## 🎮 Ejemplos Incluidos

El proyecto incluye varios ejemplos pre-configurados:
- **particles.app.json** - Sistema de partículas
- **pong.app.json** - Juego Pong clásico
- **arkanoid.app.json** - Juego tipo Breakout
- **camera.app.json** - Demostraciones de cámara
- **shaders.app.json** - Ejemplos de shaders

## 🤝 Funcionalidades de Colaboración

### Creación de Salas
- Crea salas públicas o privadas
- Configuración de límites de usuarios
- Gestión de permisos

### Sincronización
- Sincronización automática de:
  - Objetos 3D y transformaciones
  - Materiales y texturas
  - Scripts y animaciones
  - Configuración de escena

### Comunicación
- Chat en tiempo real
- Notificaciones de acciones
- Estados de usuarios conectados

## 🎯 Casos de Uso

- **Educación**: Enseñanza de gráficos 3D y programación
- **Prototipado**: Creación rápida de prototipos 3D
- **Colaboración remota**: Trabajo en equipo en proyectos 3D
- **Desarrollo de juegos**: Diseño de niveles y assets
- **Visualización de datos**: Creación de gráficos 3D interactivos

## 📝 Licencia

MIT - Ver archivo LICENSE para más detalles.

## 🙏 Créditos

Basado en el editor oficial de Three.js por **mrdoob** y la comunidad de Three.js.

Funcionalidades de colaboración desarrolladas para permitir trabajo en equipo en tiempo real.

## 🐛 Problemas y Contribuciones

Si encuentras algún problema o quieres contribuir:
1. Abre un issue describiendo el problema
2. Fork el proyecto
3. Crea una rama para tu feature
4. Envía un pull request

---

¡Disfruta creando experiencias 3D colaborativas con ThreeLinker! 🚀✨