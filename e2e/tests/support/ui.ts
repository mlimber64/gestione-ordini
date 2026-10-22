import { Page, expect } from '@playwright/test';
import { credentials } from './api';

/** Dalla lista degli ordini cerca il numero e apre il dettaglio (la riga della tabella è cliccabile). */
export async function openOrder(page: Page, number: string): Promise<void> {
  await page.getByRole('link', { name: 'Ordini' }).click();
  await page.getByLabel("Cerca per numero d'ordine").fill(number);
  await page.getByRole('row', { name: new RegExp(number) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(number);
}

/** Accede dalla schermata di login (con la baseURL del test) senza aspettare l'esito. */
export async function login(page: Page, password = credentials.password): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Nome utente').fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}
