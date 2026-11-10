import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.  npm run test:e2e
 *  - e2e/public.spec.ts  : public pages, accessibility (axe), phones, languages — no database needed.
 *  - e2e/flows.spec.ts   : booking, assignments, quizzes, tutor isolation — needs a Supabase project
 *                          (see README "Running the end-to-end tests"). Skipped if not configured.
 */
const PORT = Number(process.env.E2E_PORT || 3200);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PORT}`,
    trace: "off",
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 740 },
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && npx next start -p ${PORT}`, port: PORT, timeout: 300_000, reuseExistingServer: true },
});
