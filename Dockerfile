# Dockerfile simple para ThreeLinker
FROM node:22-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar todas las dependencias (incluye devDependencies para concurrently)
RUN npm install

# Copiar todo el código fuente
COPY . .

# Exponer puertos
# EXPOSE 3001 5173

# Ejecutar el comando dev:full
CMD ["npm", "run", "dev:full"]