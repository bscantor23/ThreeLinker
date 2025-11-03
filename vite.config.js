import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 8080,
    open: true,
  },
  build: {
    outDir: "dist",
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
