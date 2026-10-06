import { defineConfig, devices } from '@playwright/test';
import { env, paths } from './config/env';

/**
 * Projects:
 *  - setup       logs in once and saves the CEO session (.auth/ceo.json)
 *  - functional  isolated test cases; each test cleans up what it created
 *  - e2e         long business flows on the demo site (they change real demo data, run one at a time)
 */
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    {
      name: 'functional',
      testDir: './tests/functional',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: paths.storageState },
      dependencies: ['setup'],
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: paths.storageState },
      dependencies: ['setup'],
    },
  ],
});
