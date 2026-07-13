import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // PWA: precachea todo el bundle (incluidos los .wasm de 7z y sql.js y los
    // ficheros de demo) para que el visor funcione completamente sin conexión.
    // El manifest vive en public/manifest.webmanifest.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm,webmanifest}", "demo/*"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: {
    // 7z-wasm es un módulo emscripten; el pre-bundling de esbuild lo rompe.
    exclude: ["7z-wasm"],
  },
});
