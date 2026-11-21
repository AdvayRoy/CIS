import { defineConfig } from "@playwright/test";

/** Worker E. Runs against an already-running integrated app (pnpm demo / pnpm dev). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/, // not *.spec.ts: vitest would pick those up
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1, // ledger + chain are shared state
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    serviceWorkers: "allow",
  },
});
