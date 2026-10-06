import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { fieldError, toast } from '@components/form';
import { MISSING_ID, qaTitle } from '@data/placement/qa';
import { routes } from '@data/routes';

test.describe('Negative', () => {
  test('N1: bo‘sh forma saqlanmaydi — sarlavha va kurs xatolari, so‘rov yuborilmaydi', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    let posted = false;
    page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === routes.placementTests) posted = true; });
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
    await expect(fieldError(page, 'course_ids')).toHaveText('Choose at least one course');
    await expect(page).toHaveURL(new RegExp(`${routes.placementTestCreate}$`));
    expect(posted, 'invalid form must not be sent').toBe(false);
  });

  test('N2: kurs tanlanmasa saqlanmaydi', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill(qaTitle('no course'));
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'course_ids')).toHaveText('Choose at least one course');
    await expect(page).toHaveURL(new RegExp(`${routes.placementTestCreate}$`));
  });

  test('N3: sarlavhasiz (faqat kurs bilan) saqlanmaydi', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    await placementTests.pickCourse('General English');
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
    await expect(page).toHaveURL(new RegExp(`${routes.placementTestCreate}$`));
  });

  test('N4: o‘chirishni bekor qilish — test qoladi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('delete cancel'));
    await page.goto(routes.placementTests);
    await placementTests.row(id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.reload();
    await expect(placementTests.row(id)).toBeVisible();
  });

  test('N5: section sarlavhasiz saqlanmaydi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('section no title'));
    const url = await placementTests.openNewSection(id);
    await page.locator('#title').fill('');
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(fieldError(page, 'title')).toHaveText('Section title is required');
    expect(page.url()).toBe(url);
  });

  test('N6: Multiple Choice savol matnisiz saqlanmaydi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('question no text'));
    const url = await placementTests.openNewSection(id);
    await page.locator('#title').fill('S1');
    await placementTests.addMultipleChoice();
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(toast(page, 'Question 1: this question needs its own text.')).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('N7: to‘g‘ri javob belgilanmasa saqlanmaydi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('no correct option'));
    const url = await placementTests.openNewSection(id);
    await page.locator('#title').fill('S1');
    const prefix = await placementTests.addMultipleChoice();
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('Question?');
    const options = page.locator(`input[id^="${prefix}_option_"]`);
    for (const [i, v] of ['a', 'b', 'c'].entries()) await options.nth(i).fill(v);
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(toast(page, 'Question 1: select the correct option.')).toBeVisible();
    expect(page.url()).toBe(url);
    const [, , , , questions] = await placementTests.rowCells(id);
    expect(questions).toBe('0');
  });

  test('N8: mavjud bo‘lmagan placement test → 404', async ({ page }) => {
    const res = await page.goto(`${routes.placementTests}/${MISSING_ID}/edit`);
    expect(res?.status()).toBe(404);
  });

  test('N9: public sahifa — mavjud bo‘lmagan lead id bilan test boshlanmaydi', async ({ page }) => {
    await page.goto(env.placementUrl);
    await page.locator('#placement-test-lead-id').fill(MISSING_ID);
    await page.getByRole('button', { name: 'Start the test' }).click();
    await expect(page.getByText('No placement test is available for this lead id.').first()).toBeVisible();
    await expect(page).not.toHaveURL(/attempt/);
  });
});
