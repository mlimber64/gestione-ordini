import { expect, test } from '@playwright/test';
import { createFixture, createOrder } from './support/api';
import { login, openOrder } from './support/ui';

test.describe('pagamenti di un ordine', () => {
  test('registra un bonifico, lo incassa e l\'ordine risulta pagato senza cambiare stato', async ({ page }) => {
    const order = await createOrder(await createFixture(), 3); // 3 x 10,00 + IVA 22% = 36,60
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    await openOrder(page, order.number);

    const payments = page.locator('app-order-payments');
    const settlement = payments.locator('.head .chip');
    await expect(settlement).toHaveText('Da pagare');
    await expect(payments.getByText('Nessun pagamento registrato')).toBeVisible();

    // Registra: l'importo proposto è tutto ciò che resta da pagare
    await payments.getByRole('button', { name: 'Registra pagamento' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Importo (€)')).toHaveValue('36.6');
    await dialog.getByLabel('Riferimento (facoltativo)').fill('CRO-E2E');
    await dialog.getByRole('button', { name: 'Registra', exact: true }).click();

    const row = payments.getByRole('row', { name: /CRO-E2E/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Bonifico');
    await expect(row).toContainText('In attesa');
    // Il pagamento in attesa occupa già tutto l'importo: non si può registrare altro
    await expect(payments.getByRole('button', { name: 'Registra pagamento' })).toHaveCount(0);
    await expect(settlement).toHaveText('Da pagare');

    await row.getByRole('button', { name: 'Incassa' }).click();
    await expect(settlement).toHaveText('Pagato');
    await expect(row).toContainText('Incassato');
    await expect(row.getByRole('button', { name: 'Incassa' })).toHaveCount(0);

    // Il pagamento è un dato a parte: l'ordine resta «In attesa» finché non lo si conferma
    await expect(page.locator('.page-header .chip')).toHaveText('In attesa');
  });

  test('un pagamento incassato si può rimborsare e l\'importo torna da incassare', async ({ page }) => {
    const order = await createOrder(await createFixture(), 1); // 12,20
    await login(page);
    await openOrder(page, order.number);

    const payments = page.locator('app-order-payments');
    await payments.getByRole('button', { name: 'Registra pagamento' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Registra', exact: true }).click();
    const row = payments.getByRole('row', { name: /Bonifico/ });
    await row.getByRole('button', { name: 'Incassa' }).click();
    await expect(payments.locator('.head .chip')).toHaveText('Pagato');

    await row.getByRole('button', { name: 'Rimborsa' }).click();

    await expect(row).toContainText('Rimborsato');
    await expect(payments.locator('.head .chip')).toHaveText('Da pagare');
    await expect(payments.getByRole('button', { name: 'Registra pagamento' })).toBeVisible();
  });
});
