import { Page, Locator } from '@playwright/test';

/** Open the "..." menu of a table row and click an item. */
export async function rowMenu(page: Page, row: Locator, item: string) {
  await row.locator('[id^="headlessui-menu-button"] button').first().click();
  await page.locator('[role="menu"]:visible').getByText(item).click();
}

/** "+" buttons of the "choose a group" tables (one per group row). */
export const addToGroupButtons = (page: Page) => page.locator('table tbody tr td:last-child button');

/** Group id ("#123" in the first column) of the row a button belongs to. */
export async function groupIdOfRow(button: Locator): Promise<string> {
  return (await button.locator('xpath=ancestor::tr/td[1]').innerText()).replace('#', '').trim();
}
