import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: true,
    port: 5174,
  },
  preview: {
    host: true,
    port: 4174,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
