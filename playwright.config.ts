import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 0.0.0.0 --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      AI_ALLOW_NO_KEY: "1",
      LOCAL_AI_MODE: "basic",
      SQLITE_PATH: path.join(__dirname, "data", "req2backlog-e2e.db"),
    },
  },
  globalSetup: path.join(__dirname, "playwright.global-setup.ts"),
});
