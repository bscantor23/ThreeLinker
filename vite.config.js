import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 5173,
    host: true, // Permite conexiones externas (necesario para Docker)
    open: false, // No abrir navegador automáticamente en Docker
    cors: true,
    hmr: {
      port: 5173,
    },
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    target: "es2022", // Soporta top-level await
    rollupOptions: {
      input: "index.html",
    },
  },
  resolve: {
    alias: {},
  },
  optimizeDeps: {
    include: ["three"],
  },
});
