import { expect, test } from '@playwright/test';
import { Fixture, authMode, createFixture } from './support/api';
import { confirmDialog, login } from './support/ui';

test.describe('accesso', () => {
  test('con una password sbagliata resta sulla schermata di accesso e mostra l\'errore', async ({ page }) => {
    await login(page, 'password-sbagliata');

    if (authMode === 'oidc') {
      // La pagina di accesso di Keycloak segnala l'errore e non rimanda alla nostra applicazione
      await expect(page).toHaveURL(/\/auth\/realms\/gestione-ordini\//);
      await expect(page.locator('[id^="input-error"]').first()).toBeVisible();
      return;
    }
    await expect(page.getByRole('alert')).toHaveText('Nome utente o password non corretti.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('senza accedere le pagine private rimandano al login', async ({ page }) => {
    await page.goto('/ordini');

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('ordine dalla creazione alla conferma', () => {
  let fixture: Fixture;

  test.beforeAll(async () => {
    fixture = await createFixture();
  });

  test('crea un ordine, lo conferma e riceve le notifiche in diretta', async ({ page }) => {
    await login(page);

    // Lo stream SSE di notification-service è collegato: da qui in poi le notifiche arrivano in diretta
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Ordini' }).click();
    await page.getByRole('link', { name: 'Nuovo ordine' }).click();
    await expect(page.getByRole('heading', { name: 'Nuovo ordine' })).toBeVisible();

    // 1. Cliente
    await page.getByLabel('Cerca il cliente per nome, codice o email').fill(fixture.customerName);
    await page.getByRole('option', { name: new RegExp(fixture.customerName) }).click();
    await expect(page.getByLabel('Indirizzo di spedizione')).toBeVisible();

    // 2. Prodotto
    await page.getByLabel('Cerca il prodotto per nome o SKU').fill(fixture.productSku);
    await page.getByRole('option', { name: new RegExp(fixture.productSku) }).click();
    await page.getByLabel('Quantità').fill('3');
    await page.getByRole('button', { name: 'Aggiungi' }).click();
    await expect(page.getByRole('row', { name: new RegExp(fixture.productSku) })).toBeVisible();

    await page.getByRole('button', { name: 'Crea ordine e riserva la merce' }).click();

    // Dettaglio dell'ordine appena creato: il numero è il titolo della pagina
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(/^ORD-/);
    const number = (await heading.innerText()).trim();
    const status = page.locator('.page-header .chip');
    await expect(status).toHaveText('In attesa');
    await expect(page.getByText(fixture.customerName).first()).toBeVisible();

    await page.getByRole('button', { name: 'Conferma' }).click();
    await confirmDialog(page, 'Conferma ordine');
    await expect(status).toHaveText('Confermato');

    // La cronologia si carica all'accesso, prima di creare l'ordine: ciò che compare qui è arrivato dallo stream.
    // Non si controlla l'avviso a comparsa perché è effimero e condivide l'unico snackbar con i messaggi locali.
    await page.getByRole('link', { name: 'Notifiche' }).click();
    await expect(page.getByRole('heading', { name: 'Notifiche' })).toBeVisible();
    const list = page.getByRole('main');
    await expect(list.getByText(`Nuovo ordine ${number}`)).toBeVisible();
    await expect(list.getByText(`Ordine ${number}: confermato`, { exact: true })).toBeVisible();
    await expect(list.getByText(`${fixture.customerName} ha effettuato un ordine`)).toBeVisible();
  });
});
