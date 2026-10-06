import { test as setup, expect } from '@playwright/test';
import { env, paths } from '@config/env';
import { routes } from '@data/routes';

setup('login as CEO', async ({ page }) => {
  expect(env.email && env.password, 'IZ_EMAIL and IZ_PASSWORD must be set (copy .env.example to .env)').toBeTruthy();
  await page.goto(routes.login);
  await page.locator('#email').fill(env.email!);
  await page.locator('#password').fill(env.password!);
  await page.locator('button[type="submit"], button.bg-primary-40').first().click();
  await page.waitForURL(/\/admin\/dashboard/);
  await expect(page.getByText('Boshqaruv paneli').first()).toBeVisible();
  await page.context().storageState({ path: paths.storageState });
});
