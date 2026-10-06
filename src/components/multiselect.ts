import { Page, expect } from '@playwright/test';
import { field, fieldBox } from './form';

/** Visible options of the open dropdown. */
export const visibleOptions = (page: Page) => page.locator('[role="option"]:visible');

/** Pick an option in a @vueform/multiselect dropdown bound to a label. */
export async function selectOption(page: Page, id: string, option: string | RegExp) {
  // no force: let Playwright wait until the sliding modal is stable
  await field(page, id).locator('[role="combobox"]').locator('xpath=..').click();
  await expect(field(page, id).locator('[role="option"]').first()).toBeVisible();
  await visibleOptions(page).filter({ hasText: option }).first().click();
}

/** Pick an option in a @vueform/multiselect inside a `fieldBox` (modals). */
export async function selectInBox(page: Page, id: string, option: string | RegExp) {
  await fieldBox(page, id).locator('.multiselect-wrapper').click();
  await expect(visibleOptions(page).first()).toBeVisible();
  await visibleOptions(page).filter({ hasText: option }).first().click();
}
