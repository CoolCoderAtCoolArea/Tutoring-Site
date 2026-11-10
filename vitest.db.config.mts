import { defineConfig } from "vitest/config";

// Database security tests: npm run test:db  (see scripts/test-db.sh)
export default defineConfig({
  test: { include: ["tests/db/**/*.test.ts"], fileParallelism: false, testTimeout: 20000 },
});
