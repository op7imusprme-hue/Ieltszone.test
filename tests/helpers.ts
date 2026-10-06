import { Page, Locator, expect } from '@playwright/test';

/** Container of a form field (the element right after the <label for=id> wrapper). */
export function field(page: Page, id: string): Locator {
  return page.locator(`xpath=//label[@for="${id}"]/../following-sibling::*[1]`).first();
}

/** Pick an option in a @vueform/multiselect dropdown bound to a label. */
export async function selectOption(page: Page, id: string, option: string | RegExp) {
  // no force: let Playwright wait until the sliding modal is stable
  await field(page, id).locator('[role="combobox"]').locator('xpath=..').click();
  await expect(field(page, id).locator('[role="option"]').first()).toBeVisible();
  await page.locator('[role="option"]:visible').filter({ hasText: option }).first().click();
}

/** Pick a date in a v-calendar date picker attached to an input. */
export async function pickDate(page: Page, inputId: string, date: Date) {
  await page.locator(`[id="${inputId}"]`).click();
  const day = page.locator(`.vc-popover-content:visible .vc-day.id-${isoDate(date)} .vc-day-content`).first();
  if (!(await day.isVisible().catch(() => false))) {
    await page.locator('.vc-popover-content:visible .vc-arrow.vc-next').first().click();
  }
  await day.click();
}

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Fake phone in the site's mask format (##) ###-##-## → 9 digits.
 * Starts with "000" so it can never belong to a real person (the site sends SMS to leads).
 */
export function randomPhone(): string {
  return '000' + String(Math.floor(100_000 + Math.random() * 899_999));
}

/**
 * Run `action` (a click that submits a form) and check the non-GET request it sends to `path`.
 * The success toast is not shown after every action (e.g. a lead update), so it can't be relied on.
 * A failed validation is also a 302/303 redirect: its errors come back in the redirected Inertia page props.
 */
export async function submit(page: Page, path: string | RegExp, action: () => Promise<void>) {
  const sent = page.waitForResponse(r => {
    if (r.request().method() === 'GET') return false;
    const pathname = new URL(r.url()).pathname;
    return typeof path === 'string' ? pathname === path : path.test(pathname);
  });
  await action();
  const res = await sent;
  expect(res.status(), `${res.request().method()} ${res.url()}`).toBeLessThan(400);
  const redirected = await res.request().redirectedTo()?.response();
  if (redirected?.headers()['x-inertia']) {
    const body = await redirected.json().catch(() => null);
    expect(body?.props?.errors ?? {}, 'validation errors').toEqual({});
  }
}

/** "Lidni olish" on an open lead card (PUT /admin/leads/{id}/department/{department}/take). */
export async function takeLead(page: Page, leadId: string) {
  await submit(page, new RegExp(`^/admin/leads/${leadId}/department/[^/]+/take$`), () =>
    page.getByRole('button', { name: 'Lidni olish' }).click(),
  );
}

/** "Saqlash" on an open lead card (PUT /admin/leads/{id}). */
export async function saveLead(page: Page, leadId: string) {
  await submit(page, `/admin/leads/${leadId}`, () => page.getByRole('button', { name: 'Saqlash' }).click());
}

/** A kanban column (header + its cards) by its title. */
export function kanbanColumn(page: Page, title: string): Locator {
  return page
    .locator('div.flex-col.bg-white.rounded-lg')
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();
}

/** Search a lead on a kanban board and open its card by ID. */
export async function openLeadOnBoard(page: Page, boardUrl: string, search: string, leadId: string) {
  await page.goto(boardUrl);
  await page.waitForLoadState('networkidle');
  const searchInput = page.locator('#search');
  if (!(await searchInput.isVisible())) {
    // Call center boards: search icon; Administration board: search inside "Filtrlash"
    const icon = page.locator('button:has(svg.ri-search-line)').first();
    if (await icon.isVisible()) await icon.click();
    else await page.getByText('Filtrlash', { exact: true }).first().click();
  }
  await searchInput.fill(search);
  // the board reloads after the search request; a card opened before that gets closed again
  const searched = page.waitForResponse(r => decodeURIComponent(r.url()).includes('filter[search]='));
  await searchInput.press('Enter');
  await searched;
  await page.waitForLoadState('networkidle');
  const card = page.getByText(`#${leadId}`, { exact: true }).locator('visible=true').first();
  await expect(card).toBeVisible();
  await card.click();
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

/** Form field wrapper (label + control) for fields that `field()` can't reach, e.g. inside modals. */
export function fieldBox(page: Page, id: string): Locator {
  return page.locator('div.flex-col').filter({ has: page.locator(`label[for="${id}"]`) }).last();
}

/** Pick an option in a @vueform/multiselect inside a `fieldBox`. */
export async function selectInBox(page: Page, id: string, option: string | RegExp) {
  await fieldBox(page, id).locator('.multiselect-wrapper').click();
  await expect(page.locator('[role="option"]:visible').first()).toBeVisible();
  await page.locator('[role="option"]:visible').filter({ hasText: option }).first().click();
}

/** Open the "..." menu of a table row and click an item. */
export async function rowMenu(page: Page, row: Locator, item: string) {
  await row.locator('[id^="headlessui-menu-button"] button').first().click();
  await page.locator('[role="menu"]:visible').getByText(item).click();
}

/** dd.mm.yyyy as shown in the admin UI. */
export function uiDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
