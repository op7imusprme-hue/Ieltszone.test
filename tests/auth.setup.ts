import { test as setup, expect } from '@playwright/test';

const EMAIL = process.env.IZ_EMAIL;
const PASSWORD = process.env.IZ_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('IZ_EMAIL and IZ_PASSWORD must be set (see .env.example)');

setup('login as CEO', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"], button.bg-primary-40').first().click();
  await page.waitForURL(/\/admin\/dashboard/);
  await expect(page.getByText('Boshqaruv paneli').first()).toBeVisible();
  await page.context().storageState({ path: '.auth/ceo.json' });
});
