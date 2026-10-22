import { expect, test } from '@playwright/test';
import { login } from './support/ui';

test.describe('interfaccia', () => {
  test('il tema si cambia dalla barra superiore e resta dopo un ricaricamento', async ({ page }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-theme', /.+/);

    await page.getByRole('button', { name: 'Tema del sistema' }).click();
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Tema chiaro' }).click();
    await expect(root).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    // Sfondo davvero scuro: il tema non è solo un attributo
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = background.match(/\d+/g)!.map(Number);
    expect(r + g + b).toBeLessThan(150);
  });

  test('il menu si comprime a sole icone, resta navigabile e ricorda la scelta', async ({ page }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
    const ordini = page.getByRole('link', { name: 'Ordini' });
    const widthOf = async () => (await page.locator('aside.sidebar').boundingBox())!.width;
    expect(await widthOf()).toBeGreaterThan(200);

    await page.getByRole('button', { name: 'Comprimi il menu' }).click();
    await expect.poll(widthOf).toBeLessThan(100);
    // Compresso, ogni voce conserva il suo nome per le tecnologie assistive e funziona
    await ordini.click();
    await expect(page).toHaveURL(/\/ordini/);

    await page.reload();
    await expect.poll(widthOf).toBeLessThan(100);
    await page.getByRole('button', { name: 'Espandi il menu' }).click();
    await expect.poll(widthOf).toBeGreaterThan(200);
  });

  test('su uno schermo stretto il menu è un cassetto che si apre e si chiude', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await login(page);
    await expect(page.getByRole('main')).toBeVisible();
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).not.toBeInViewport();

    await page.getByRole('button', { name: 'Apri il menu' }).click();
    await expect(sidebar).toBeInViewport();
    await page.getByRole('link', { name: 'Clienti' }).click();
    await expect(page).toHaveURL(/\/clienti/);
    await expect(sidebar).not.toBeInViewport();
  });
});

test.describe('accessibilità', () => {
  test('il collegamento «Vai al contenuto» è il primo della pagina e porta il focus sul contenuto senza cambiare pagina', async ({ page }) => {
    await login(page);
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();
    await page.goto('/ordini');
    await expect(page.getByText('In diretta', { exact: true })).toBeVisible();

    // Primo elemento raggiungibile da tastiera, in ordine di documento
    const first = await page.evaluate(() => document.querySelector('a[href], button')?.textContent?.trim());
    expect(first).toBe('Vai al contenuto');

    const skip = page.getByRole('link', { name: 'Vai al contenuto' });
    await skip.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/ordini$/);
    await expect(page.locator('main#contenuto')).toBeFocused();
  });
});
