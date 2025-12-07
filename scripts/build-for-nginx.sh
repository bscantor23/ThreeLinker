#!/bin/bash

# build-for-nginx.sh - Script para construir ThreeLinker para nginx

echo "🏗️  Construyendo ThreeLinker para nginx..."

# Limpiar directorio de build anterior
if [ -d "dist" ]; then
    echo "🧹 Limpiando build anterior..."
    rm -rf dist
fi

# Build de Vite
echo "📦 Ejecutando build de Vite..."
npm run build

# Verificar que el build fue exitoso
if [ ! -d "dist" ]; then
    echo "❌ Error: No se pudo crear el directorio dist"
    exit 1
fi

# Crear directorio de deployment para nginx
NGINX_DIR="/var/www/threelinker"
echo "📁 Preparando directorio nginx: $NGINX_DIR"

# Crear directorio si no existe (requiere sudo)
if [ ! -d "$NGINX_DIR" ]; then
    echo "🔑 Creando directorio nginx (requiere sudo)..."
    sudo mkdir -p "$NGINX_DIR"
fi

# Copiar archivos build a directorio nginx
echo "📋 Copiando archivos a nginx..."
sudo cp -r dist/* "$NGINX_DIR/"

# Establecer permisos correctos
echo "🔒 Estableciendo permisos..."
sudo chown -R www-data:www-data "$NGINX_DIR"
sudo chmod -R 755 "$NGINX_DIR"

# Verificar archivos copiados
echo "✅ Verificando deployment..."
if [ -f "$NGINX_DIR/index.html" ]; then
    echo "✅ index.html copiado correctamente"
else
    echo "❌ Error: index.html no encontrado en $NGINX_DIR"
    exit 1
fi

# Mostrar estadísticas del build
echo "📊 Estadísticas del build:"
echo "Archivos en dist/:"
find dist -type f -name "*.js" -o -name "*.css" -o -name "*.html" | wc -l
echo "Tamaño total del build:"
du -sh dist/

echo "🎉 Build completado exitosamente!"
echo "📝 Archivos desplegados en: $NGINX_DIR"
echo ""
echo "🔄 Para aplicar cambios, recarga nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "🌐 Accede a la aplicación en: http://localhost"