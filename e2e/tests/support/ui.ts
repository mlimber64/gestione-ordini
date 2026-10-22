import { Page, expect } from '@playwright/test';
import { credentials } from './api';

/** Accede dalla schermata di login (con la baseURL del test) senza aspettare l'esito. */
export async function login(page: Page, password = credentials.password): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Nome utente').fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}
