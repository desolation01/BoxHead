import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: [
      "stereo-decimeter-gas.ngrok-free.dev"
    ],
    proxy: {
      "/relay": {
        target: "ws://127.0.0.1:3001",
        ws: true,
        changeOrigin: true
      }
    }
  }
});
