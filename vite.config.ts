/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 3016, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js changes rarely; a separate chunk stays cached across app releases.
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
