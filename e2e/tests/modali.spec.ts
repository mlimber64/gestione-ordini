import { expect, test } from '@playwright/test';
import { createFixture, createOrder } from './support/api';
import { confirmDialog, login, openOrder } from './support/ui';

test.describe('azioni in finestre modali', () => {
  test('un nuovo cliente si registra da una finestra, con il suo indirizzo, e si può bloccare con conferma', async ({ page }) => {
    const suffix = Date.now().toString(36).toUpperCase();
    const name = `E2E Cliente ${suffix}`;
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Clienti' }).click();
    await page.getByRole('button', { name: 'Nuovo cliente' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Nuovo cliente' })).toBeVisible();

    await dialog.getByLabel('Ragione sociale o nome').fill(name);
    await dialog.getByLabel('Email').fill(`e2e-${suffix.toLowerCase()}@example.test`);
    await dialog.getByText("Aggiungi subito l'indirizzo di spedizione").click();
    await dialog.getByLabel('Via e numero civico').fill('Via del Test 1');
    await dialog.getByLabel('Città').fill('Salerno');
    await dialog.getByLabel('Provincia').fill('SA');
    await dialog.getByLabel('CAP').fill('84121');
    await dialog.getByRole('button', { name: 'Registra cliente' }).click();

    // La scheda del cliente appena registrato, con l'indirizzo di spedizione già dentro
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page.locator('.address')).toContainText('Via del Test 1');
    await expect(page.locator('.address')).toContainText('Predefinito');
    const status = page.locator('.page-header .chip');
    await expect(status).toHaveText('Attivo');

    // Bloccare chiede conferma: «Indietro» e Esc lasciano tutto com'era
    await page.getByRole('button', { name: 'Blocca' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Bloccare il cliente?' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Indietro' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(status).toHaveText('Attivo');

    await page.getByRole('button', { name: 'Blocca' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(status).toHaveText('Attivo');

    await page.getByRole('button', { name: 'Blocca' }).click();
    await confirmDialog(page, 'Blocca cliente');
    await expect(status).toHaveText('Bloccato');
  });

  test('confermare un ordine chiede conferma: chiudere la finestra non cambia lo stato', async ({ page }) => {
    const order = await createOrder(await createFixture(), 1);
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
    await openOrder(page, order.number);
    const status = page.locator('.page-header .chip');
    await expect(status).toHaveText('In attesa');

    await page.getByRole('button', { name: 'Conferma' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: "Confermare l'ordine?" })).toBeVisible();
    await dialog.getByRole('button', { name: 'Indietro' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(status).toHaveText('In attesa');

    await page.getByRole('button', { name: 'Conferma' }).click();
    await confirmDialog(page, 'Conferma ordine');
    await expect(status).toHaveText('Confermato');
  });
});
