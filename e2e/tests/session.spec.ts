import { expect, test } from '@playwright/test';
import { tlsUrl } from './support/api';
import { login } from './support/ui';

const REFRESH_COOKIE = 'gestione_ordini_refresh';

test.describe('sessione con il token di refresh in un cookie HttpOnly', () => {
  test('il cookie è HttpOnly e SameSite=Strict e la pagina non ne tiene copie', async ({ page, context }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/v1/auth' });
    // Cookie «di sessione»: nessuna scadenza
    expect(cookie!.expires).toBe(-1);

    // Il codice della pagina non lo vede e non ne esistono copie nel browser
    const visible = await page.evaluate(() => ({
      cookies: document.cookie,
      session: JSON.stringify({ ...sessionStorage }),
      local: JSON.stringify({ ...localStorage }),
    }));
    expect(visible.cookies).not.toContain(REFRESH_COOKIE);
    expect(visible.session).not.toMatch(/refresh|eyJ/i);
    expect(visible.local).not.toMatch(/refresh|eyJ/i);
  });

  test('ricaricando la pagina la sessione si ripristina dal cookie', async ({ page }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    await page.reload();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
  });

  test('il logout elimina il cookie e un ricaricamento riporta al login', async ({ page, context }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /admin/ }).click();
    await page.getByRole('menuitem', { name: 'Esci' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === REFRESH_COOKIE)).toBe(false);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test.describe('in HTTPS', () => {
    test.use({ baseURL: tlsUrl, ignoreHTTPSErrors: true });

    test('il cookie è anche Secure', async ({ page, context }) => {
      await login(page);
      await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

      const cookie = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE);
      expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict' });
    });
  });
});
