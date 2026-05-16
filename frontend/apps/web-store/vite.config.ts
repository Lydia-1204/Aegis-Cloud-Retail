import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export default defineConfig({
  base: env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  server: { port: 5174 },
});
