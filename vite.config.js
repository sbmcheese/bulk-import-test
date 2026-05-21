import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { directDbPlugin } from "./vite-plugin-direct-db.js";

dotenv.config();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), directDbPlugin()],
  server: {
    port: 80,
    host: true,
  },
  preview: {
    port: 80,
    host: true,
  },
});
