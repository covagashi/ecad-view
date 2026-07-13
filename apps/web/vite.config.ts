import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // 7z-wasm es un módulo emscripten; el pre-bundling de esbuild lo rompe.
    exclude: ["7z-wasm"],
  },
});
