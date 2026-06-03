import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Run tests in parallel
  fullyParallel: true,
  // Fail the build on CI if any test.only is left in source
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // Base URL for all tests — matches Vite dev server default
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    // ── iPhone 14 on WebKit (primary iOS test target) ─────────────────────────
    {
      name: 'iPhone 14 WebKit',
      use: {
        ...devices['iPhone 14'],
        browserName: 'webkit',
      },
    },
    // ── iPhone SE (small screen) ──────────────────────────────────────────────
    {
      name: 'iPhone SE WebKit',
      use: {
        ...devices['iPhone SE'],
        browserName: 'webkit',
      },
    },
    // ── iPad (tablet layout check) ───────────────────────────────────────────
    {
      name: 'iPad Pro WebKit',
      use: {
        ...devices['iPad Pro 11'],
        browserName: 'webkit',
      },
    },
  ],

  // Auto-start the Vite dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
