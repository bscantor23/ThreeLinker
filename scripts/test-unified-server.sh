#!/bin/bash

# test-unified-server.sh - Script para probar el servidor unificado

echo "🧪 Testing ThreeLinker Unified Server"
echo "====================================="

# Función para probar una instancia
test_instance() {
    local port=$1
    local instance_id=$2
    
    echo ""
    echo "🚀 Probando instancia: $instance_id en puerto $port"
    
    # Iniciar servidor en background
    echo "📡 Iniciando servidor..."
    PORT=$port INSTANCE_ID=$instance_id node server-unified.js &
    local pid=$!
    
    # Esperar a que el servidor inicie
    echo "⏳ Esperando servidor..."
    sleep 5
    
    # Probar endpoints
    echo "🔍 Probando endpoints..."
    
    # Health check
    echo "  - Health check:"
    curl -s "http://localhost:$port/api/health" | jq -r '.instance + " - " + .status' || echo "    ❌ Falló"
    
    # Stats
    echo "  - Estadísticas:"
    curl -s "http://localhost:$port/api/stats" | jq -r '.instance + " (users: " + (.users.totalUsers|tostring) + ")"' || echo "    ❌ Falló"
    
    # Load balancer info
    echo "  - Load balancer:"
    curl -s "http://localhost:$port/api/load-balancer" | jq -r '.currentInstance + " - " + .algorithm' || echo "    ❌ Falló"
    
    # Instance info
    echo "  - Instance info:"
    curl -s "http://localhost:$port/api/instance" | jq -r '.INSTANCE_ID + " (PID: " + (.pid|tostring) + ")"' || echo "    ❌ Falló"
    
    # Health check específico
    echo "  - Health check específico:"
    curl -s "http://localhost:$port/health/$instance_id" | jq -r '.instance + " - " + .status' || echo "    ❌ Falló"
    
    # Parar servidor
    echo "🛑 Parando servidor..."
    kill $pid 2>/dev/null
    wait $pid 2>/dev/null
    
    echo "✅ Test de $instance_id completado"
}

# Verificar dependencias
if ! command -v jq &> /dev/null; then
    echo "❌ jq no está instalado. Instalando..."
    if command -v brew &> /dev/null; then
        brew install jq
    elif command -v apt-get &> /dev/null; then
        sudo apt-get install -y jq
    else
        echo "Por favor instala jq manualmente"
        exit 1
    fi
fi

# Verificar que el archivo existe
if [ ! -f "server-unified.js" ]; then
    echo "❌ server-unified.js no encontrado"
    exit 1
fi

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

echo "🔧 Configuración de prueba:"
echo "  - Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
echo "  - Servidor unificado: server-unified.js"

# Probar instancia 1 (puerto 3001)
test_instance 3001 "server-1"

# Probar instancia 2 (puerto 3002)  
test_instance 3002 "server-2"

# Probar puerto personalizado
test_instance 3003 "server-custom"

echo ""
echo "🎉 Testing completado!"
echo ""
echo "📝 Notas:"
echo "  - Cada instancia se configura automáticamente según PORT e INSTANCE_ID"
echo "  - El servidor detecta automáticamente la configuración correcta"
echo "  - Todos los endpoints están disponibles en cada instancia"
echo "  - Redis Adapter se configura automáticamente si Redis está disponible"
echo ""
echo "🚀 Para iniciar en desarrollo:"
echo "  npm run dev:ha"
echo ""
echo "🐳 Para iniciar con Docker:"
echo "  ./scripts/deploy-ha.sh start"