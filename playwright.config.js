import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 3777;
// Set E2E_BASE_URL=https://your-deployment to run the suite against a live site instead of a local server.
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: REMOTE || `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: REMOTE ? undefined : {
    command: `node server/index.js`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      ORDERS_FILE: 'test-results/orders.e2e.json',
      RATE_LIMIT: 'off',
      // Tracking is a pure function of (order, instant), so the only way to watch a rider ride in
      // a few seconds is to move the clock. The server honours ?at= only with this switch on.
      TRACKING_TIME_TRAVEL: '1',
      DISPATCH_TOKEN: 'dev-dispatch-token',
    },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
});
