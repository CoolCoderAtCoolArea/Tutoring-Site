import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests (no database needed): npm test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
