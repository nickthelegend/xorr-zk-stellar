import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// snarkjs / circomlibjs expect Node globals (Buffer, process) in the browser.
export default defineConfig({
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, process: true } })],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // allow the *.app.github.dev forwarded host (Codespaces)
    // Same-origin proxy to the delivery/off-ramp/faucet backend, so the browser
    // never has to reach localhost:8787 directly (works in Codespaces too).
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: { target: "es2022" },
});
