import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cabeçalhos de segurança no preview, assetsInlineLimit e PWA entram nas tarefas W1-03 e W1-12 (App).
export default defineConfig({
  plugins: [react()],
});
