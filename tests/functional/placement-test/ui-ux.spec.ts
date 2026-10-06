import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { fieldError } from '@components/form';
import { qaTitle } from '@data/placement/qa';
import { routes } from '@data/routes';

test.describe('UI/UX', () => {
  test('U1: ro‘yxat sahifasi — sarlavha, ustunlar, "New Placement Test" tugmasi', async ({ page }) => {
    await page.goto(routes.placementTests);
    await expect(page.getByRole('heading', { name: 'Placement Tests' }).or(page.getByText('Placement Tests', { exact: true })).first()).toBeVisible();
    const headers = (await page.locator('thead th').allInnerTexts()).map(t => t.trim().toUpperCase()).filter(Boolean);
    expect(headers).toEqual(['ID', 'SARLAVHA', 'KURSLAR', 'SECTIONS', 'QUESTIONS', 'TIME LIMIT', 'HARAKATLAR']);
    await page.getByRole('link', { name: 'New Placement Test' }).click();
    await expect(page).toHaveURL(new RegExp(`${routes.placementTestCreate}$`));
  });

  test('U2: yaratish formasi — label, placeholder, maslahat matni, tugmalar', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    await expect(page.locator('label[for="title"]')).toHaveText('Sarlavha');
    await expect(page.locator('label[for="course_ids"]')).toHaveText('Kurslar');
    await expect(page.locator('#title')).toHaveAttribute('placeholder', 'Placement test title');
    await expect(page.getByText('Time limit', { exact: true })).toBeVisible();
    await expect(page.locator('label[for="placement_time_limit_minutes"]')).toHaveText('Minutes');
    await expect(page.locator('label[for="placement_time_limit_seconds"]')).toHaveText('Seconds');
    await expect(page.getByText('Save the placement test first, then add its sections.')).toBeVisible();
    await expect(placementTests.saveAndAddSections).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Bekor qilish' })).toBeVisible();
  });

  test('U3: kurslar dropdown — General English, IELTS, CEFR bor', async ({ page }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('[data-field="course_ids"] .multiselect-wrapper').click();
    const options = page.locator('[role="option"]:visible');
    for (const course of ['General English', 'IELTS', 'CEFR']) await expect(options.filter({ hasText: course })).toHaveCount(1);
  });

  test('U4: "Bekor qilish" va "Orqaga" ro‘yxatga qaytaradi', async ({ page }) => {
    await page.goto(routes.placementTestCreate);
    await page.getByRole('button', { name: 'Bekor qilish' }).click();
    await expect(page).toHaveURL(new RegExp(`${routes.placementTests}$`));
    await page.goto(routes.placementTestCreate);
    await page.getByText('Orqaga', { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${routes.placementTests}$`));
  });

  test('U5: xato maydon qizil + aria-invalid, matn kiritilgach xato yo‘qoladi', async ({ page, placementTests, placementTestsApi }) => {
    await page.goto(routes.placementTestCreate);
    await placementTests.saveAndAddSections.click();
    const title = page.locator('#title');
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(title).toHaveAttribute('aria-describedby', 'title-error');
    await expect(title).toHaveClass(/border-red/);
    await title.fill('AT-QA something');
    await placementTests.pickCourse('General English');
    await page.locator('#placement_time_limit_minutes').click();
    await placementTests.saveAndAddSections.click().catch(() => {});
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    placementTestsApi.track(page.url().match(/(\d+)$/)![1]);
    await expect(fieldError(page, 'title')).toHaveCount(0);
  });

  test('U6: o‘chirish dialogi — ogohlantirish matni va 2 ta tugma', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('delete dialog'));
    await page.goto(routes.placementTests);
    await placementTests.row(id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete placement test')).toBeVisible();
    await expect(dialog).toContainText('This action cannot be undone.');
    await expect(dialog.getByRole('button', { name: 'Oʻchirish' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Bekor qilish' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('U7: tahrirlash formasi mavjud qiymatlar bilan ochiladi', async ({ page, placementTestsApi }) => {
    const title = qaTitle('edit prefill');
    const id = await placementTestsApi.create(title, ['General English'], '7:45');
    await page.goto(`${routes.placementTests}/${id}/edit`);
    await expect(page.locator('#title')).toHaveValue(title);
    await expect(page.locator('[data-field="course_ids"]')).toContainText('General English');
    await expect(page.locator('#placement_time_limit_minutes')).toHaveValue('7');
    await expect(page.locator('#placement_time_limit_seconds')).toHaveValue('45');
    await expect(page.getByRole('button', { name: 'Saqlash' })).toBeVisible();
  });

  test('U8: section editor — savol turlari ro‘yxati', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('question types'));
    await placementTests.openNewSection(id);
    await page.getByRole('button', { name: 'Add Question', exact: true }).click();
    const blockId = (await page.locator('label[for^="question_type_"]').last().getAttribute('for'))!.replace('question_type_', '');
    await page.locator(`xpath=//label[@for="question_type_${blockId}"]/../following-sibling::*[1]`).locator('.multiselect-wrapper').click();
    const types = (await page.locator('[role="option"]:visible').allInnerTexts()).map(t => t.trim());
    expect(types).toEqual(expect.arrayContaining([
      'Completion', 'Multiple Choice', 'Multi Select', 'Matching Features', 'Sentence Reordering', 'Writing',
    ]));
  });

  test('U9: mobil (375px) — gorizontal scroll yo‘q', async ({ newPage }) => {
    const page = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
    await page.goto(routes.placementTestCreate);
    await expect(page.locator('#title')).toBeVisible();
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(width);
  });

  test('U10: public sahifa — bo‘sh lead id’da "Start the test" o‘chiq, kiritilganda yoqiladi', async ({ page }) => {
    await page.goto(env.placementUrl);
    const input = page.locator('#placement-test-lead-id');
    const start = page.getByRole('button', { name: 'Start the test' });
    await expect(input).toBeFocused(); // autofocus
    await expect(input).toHaveAttribute('placeholder', /For example/);
    await expect(start).toBeDisabled();
    await input.fill('123');
    await expect(start).toBeEnabled();
    await input.fill('');
    await expect(start).toBeDisabled();
  });
});
