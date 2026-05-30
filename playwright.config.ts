import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PORT = Number(process.env["PLAYWRIGHT_PORT"] ?? 3000);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: !process.env["CI"],
    env: {
      NODE_ENV: "development",
    },
  },
});
