import { Page } from '@playwright/test';
import { isoDate } from '@utils/dates';

/** Pick a date in a v-calendar date picker attached to an input (this or next month). */
export async function pickDate(page: Page, inputId: string, date: Date) {
  await page.locator(`[id="${inputId}"]`).click();
  const day = page.locator(`.vc-popover-content:visible .vc-day.id-${isoDate(date)} .vc-day-content`).first();
  if (!(await day.isVisible().catch(() => false))) {
    await page.locator('.vc-popover-content:visible .vc-arrow.vc-next').first().click();
  }
  await day.click();
}

/**
 * Pick a far date (e.g. birthday) in a v-calendar picker using its month/year navigation.
 * The calendar may open on a max-allowed date (e.g. 2012 for date of birth).
 */
export async function pickDateViaNav(page: Page, inputId: string, date: Date) {
  await page.locator(`[id="${inputId}"]`).click();
  const picker = page.locator('.vc-date-picker-content:visible').first();
  await picker.locator('.vc-title').click();
  const nav = page.locator('.vc-nav-popover-container:visible').first();
  const yearTitle = nav.locator('.vc-nav-title');
  for (let i = 0; i < 50; i++) {
    const year = Number((await yearTitle.innerText()).trim());
    if (year === date.getFullYear()) break;
    await nav.locator(year > date.getFullYear() ? '.vc-nav-arrow.is-left' : '.vc-nav-arrow.is-right').click();
  }
  const month = 'M' + String(date.getMonth() + 1).padStart(2, '0');
  await nav.locator('.vc-nav-item', { hasText: month }).click();
  await picker.locator(`.vc-day.id-${isoDate(date)} .vc-day-content`).click();
}
