import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node server.js",
    env: { PORT: "4174", HOST: "127.0.0.1" },
    url: "http://127.0.0.1:4174/health",
    reuseExistingServer: false,
    timeout: 20_000
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
