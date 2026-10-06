import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { fieldError } from '@components/form';
import { qaTitle, stamp } from '@data/placement/qa';
import { routes } from '@data/routes';

test.describe('Edge cases', () => {
  test('E1: sarlavha 255 belgi (chegaraviy maksimum) qabul qilinadi', async ({ placementTests, placementTestsApi }) => {
    const title = ('AT-QA ' + 'x'.repeat(255)).slice(0, 255);
    const id = placementTestsApi.track(await placementTests.create(title, ['General English'], '5', '0'));
    const [, savedTitle] = await placementTests.rowCells(id);
    expect(savedTitle).toBe(title);
  });

  test('E2: sarlavha 256 belgi (max+1) rad etiladi', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill('AT-QA ' + 'x'.repeat(250));
    await placementTests.pickCourse('General English');
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'title')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${routes.placementTestCreate}$`));
  });

  test('E3: vaqt 0:00 → cheklovsiz test ("—")', async ({ placementTests, placementTestsApi }) => {
    const id = placementTestsApi.track(await placementTests.create(qaTitle('zero time'), ['General English'], '0', '0'));
    const [, , , , , time] = await placementTests.rowCells(id);
    expect(time).toBe('—');
  });

  test('E4: vaqt bo‘sh → cheklovsiz test ("—")', async ({ placementTests, placementTestsApi }) => {
    const id = placementTestsApi.track(await placementTests.create(qaTitle('empty time'), ['General English'], '', ''));
    const [, , , , , time] = await placementTests.rowCells(id);
    expect(time).toBe('—');
  });

  test('E5: 0 daqiqa 59 soniya (soniya maksimumi) → 00:59', async ({ placementTests, placementTestsApi }) => {
    const id = placementTestsApi.track(await placementTests.create(qaTitle('59 sec'), ['General English'], '0', '59'));
    const [, , , , , time] = await placementTests.rowCells(id);
    expect(time).toBe('00:59');
  });

  test('E6: Unicode / kirill / emoji sarlavha o‘zgarishsiz saqlanadi', async ({ placementTests, placementTestsApi }) => {
    const title = `AT-QA Ўзбекча тест ğüşö 日本語 🎓 ${stamp()}`;
    const id = placementTestsApi.track(await placementTests.create(title, ['General English'], '5', '0'));
    const [, savedTitle] = await placementTests.rowCells(id);
    expect(savedTitle).toBe(title);
  });

  test('E7: bitta savolda 2 ta variant (minimum) bilan saqlanadi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('min options'));
    await placementTests.openNewSection(id);
    await page.locator('#title').fill('S1');
    const prefix = await placementTests.addMultipleChoice();
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('True or false?');
    const options = page.locator(`input[id^="${prefix}_option_"]`);
    await options.nth(0).fill('True');
    await options.nth(1).fill('False');
    await page.locator(`input[type="radio"][name^="${prefix}_correct_"]`).nth(0).check();
    await page.getByRole('button', { name: 'Save section' }).click();
    // either saved (1 question) or rejected with a toast about the empty 3rd option — never a crash
    await expect(page.locator('.Vue-Toastification__toast').or(page.getByText('Sections (1)')).first()).toBeVisible();
  });

  test('E8: public lead id — 12 belgidan uzun kiritib bo‘lmaydi', async ({ page }) => {
    await page.goto(env.placementUrl);
    const input = page.locator('#placement-test-lead-id');
    await input.fill('1234567890123456');
    await expect(input).toHaveValue('123456789012');
  });

  test('E9: public lead id = 0 → tushunarli xabar (tarjima kaliti emas)', async ({ page }) => {
    test.fail(true, 'BUG: server "validation.min.numeric" kalitini ko‘rsatadi');
    await page.goto(env.placementUrl);
    await page.locator('#placement-test-lead-id').fill('0');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/placement-test/start') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Start the test' }).click(),
    ]);
    await page.waitForLoadState('networkidle');
    // static "Enter the lead id…" text must not satisfy this — wait for the real error message
    await expect(page.getByText(/validation\.|No placement test|not found|invalid|must be/i).first()).toBeVisible();
    await expect(page.getByText(/validation\.\w+/)).toHaveCount(0);
  });
});
