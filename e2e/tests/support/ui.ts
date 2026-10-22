import { Page, expect } from '@playwright/test';
import { authMode, credentials } from './api';

/** Dalla lista degli ordini cerca il numero e apre il dettaglio (la riga della tabella è cliccabile). */
export async function openOrder(page: Page, number: string): Promise<void> {
  await page.getByRole('link', { name: 'Ordini' }).click();
  await page.getByLabel("Cerca per numero d'ordine").fill(number);
  await page.getByRole('row', { name: new RegExp(number) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(number);
}

/**
 * Accede dalla schermata di login (con la baseURL del test) senza aspettare l'esito. Con Keycloak (E2E_AUTH=oidc)
 * il modulo è quello della pagina di accesso del provider, non quello dell'applicazione.
 */
export async function login(page: Page, password = credentials.password): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  if (authMode === 'oidc') {
    await page.getByRole('link', { name: 'Accedi con Keycloak' }).click();
    await page.locator('#username').fill(credentials.username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
    return;
  }
  await page.getByLabel('Nome utente').fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}
