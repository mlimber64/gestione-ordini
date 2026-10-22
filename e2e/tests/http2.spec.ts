import { expect, test } from '@playwright/test';
import { tlsUrl } from './support/api';
import { login } from './support/ui';

// Con HTTP/1.1 un browser apre al massimo ~6 connessioni per origine e ogni scheda ne tiene una per lo stream SSE:
// la settima scheda resterebbe in attesa. HTTP/2 le multiplexa tutte su una sola connessione.
const SCHEDE = 8;

test.describe('HTTPS con HTTP/2', () => {
  test.use({ baseURL: tlsUrl, ignoreHTTPSErrors: true }); // certificato autofirmato

  test(`${SCHEDE} schede aperte insieme ricevono tutte lo stream in diretta`, async ({ context }) => {
    test.setTimeout(120_000);
    const pages = await Promise.all(Array.from({ length: SCHEDE }, () => context.newPage()));

    // Ogni scheda ha la sua sessione (il token di refresh sta in sessionStorage) e il suo stream SSE
    for (const page of pages) await login(page);

    for (const page of pages) await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
  });

  test('il browser negozia davvero HTTP/2', async ({ page }) => {
    await page.goto('/');

    const protocol = await page.evaluate(
      () => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).nextHopProtocol,
    );
    expect(protocol).toBe('h2');
  });
});
