import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import assetLinks from "./assetlinks.plugin.js";
export default defineConfig({
  plugins: [react(), assetLinks()],
  server: {
    port: 5174,
    proxy: { "/api": { target: "http://localhost:5001", changeOrigin: true } },
  },
});
