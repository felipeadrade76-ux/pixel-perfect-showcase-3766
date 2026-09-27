import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4188",
    headless: true,
  },
  webServer: {
    command: "PORT=4188 HOST=127.0.0.1 bun run start",
    url: "http://127.0.0.1:4188/login",
    timeout: 90_000,
    reuseExistingServer: false,
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
    },
  },
});
