import { Page, Locator } from '@playwright/test';

/** Container of a form field (the element right after the <label for=id> wrapper). */
export function field(page: Page, id: string): Locator {
  return page.locator(`xpath=//label[@for="${id}"]/../following-sibling::*[1]`).first();
}

/** Form field wrapper (label + control) for fields that `field()` can't reach, e.g. inside modals. */
export function fieldBox(page: Page, id: string): Locator {
  return page.locator('div.flex-col').filter({ has: page.locator(`label[for="${id}"]`) }).last();
}

/** Validation message under a field. */
export function fieldError(page: Page, id: string): Locator {
  return page.locator(`[id="${id}-error"]`);
}

/** Toast notification (vue-toastification). */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator('.Vue-Toastification__toast').filter({ hasText: text }).first();
}
