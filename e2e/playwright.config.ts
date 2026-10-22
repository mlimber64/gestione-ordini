import { defineConfig, devices } from '@playwright/test';

/**
 * I test provano lo stack completo già avviato (docker compose --profile app): non lo avviano loro.
 * Variabili: E2E_BASE_URL (predefinita http://localhost:8080), E2E_USER e E2E_PASSWORD (admin / admin-demo-1234).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // I test condividono lo stesso database: ognuno crea i propri dati con nomi unici, ma l'ordine resta sequenziale
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'it-IT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
