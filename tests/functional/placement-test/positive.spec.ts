import { test, expect } from '@fixtures';
import { toast } from '@components/form';
import { selectOption } from '@components/multiselect';
import { qaTitle } from '@data/placement/qa';
import { routes } from '@data/routes';
import { submit } from '@utils/network';

test.describe('Positive', () => {
  test('P1: yangi placement test yaratish (2 kurs, 5:00) → ro‘yxatda chiqadi', async ({ page, placementTests, placementTestsApi }) => {
    const title = qaTitle('positive create');
    const id = placementTestsApi.track(await placementTests.create(title, ['General English', 'IELTS'], '5', '0'));
    await expect(page.getByText('Sections (0)')).toBeVisible();

    const [cellId, cellTitle, courses, sections, questions, time] = await placementTests.rowCells(id);
    expect(cellId).toBe(id);
    expect(cellTitle).toBe(title);
    expect(courses).toBe('General English, IELTS');
    expect(sections).toBe('0');
    expect(questions).toBe('0');
    expect(time).toBe('05:00');
  });

  test('P2: testni tahrirlash — sarlavha, kurs va vaqt yangilanadi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('positive edit'));
    const newTitle = qaTitle('positive edited');
    await page.goto(routes.placementTests);
    await placementTests.row(id).locator(`a[href$="/admin/placement-test/${id}/edit"]`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/placement-test/${id}/edit$`));
    await page.locator('#title').fill(newTitle);
    await placementTests.pickCourse('IELTS');
    await page.locator('#placement_time_limit_minutes').fill('12');
    await page.locator('#placement_time_limit_seconds').fill('30');
    await submit(page, `${routes.placementTests}/${id}`, () => page.getByRole('button', { name: 'Saqlash' }).click());

    const [, title, courses, , , time] = await placementTests.rowCells(id);
    expect(title).toBe(newTitle);
    expect(courses).toContain('IELTS');
    expect(time).toBe('12:30');
  });

  test('P3: section + Multiple Choice savol (4 variant, to‘g‘ri javob belgilangan) saqlanadi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('positive section'), ['General English', 'IELTS']);
    await placementTests.openNewSection(id);
    await page.locator('#title').fill('A1 Beginner');
    await selectOption(page, 'course_id', /^Beginner$/);
    const prefix = await placementTests.addMultipleChoice();
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('She ______ a teacher.');
    const article = page.locator('article').filter({ has: page.locator(`textarea[id^="${prefix}_question_"]`) });
    const options = article.locator(`input[id^="${prefix}_option_"]`);
    await article.getByRole('button', { name: 'Add options' }).click();
    await expect(options).toHaveCount(4);
    for (const [i, v] of ['am', 'is', 'are', 'be'].entries()) await options.nth(i).fill(v);
    await article.locator(`input[type="radio"][name^="${prefix}_correct_"]`).nth(1).check();
    await submit(page, new RegExp(`^/admin/placement-test/${id}/sections`), () =>
      page.getByRole('button', { name: 'Save section' }).click(),
    );
    await expect(page).toHaveURL(new RegExp(`/admin/placement-test/${id}$`));
    await expect(page.getByText('Sections (1)')).toBeVisible();

    const [, , , sections, questions] = await placementTests.rowCells(id);
    expect(sections).toBe('1');
    expect(questions).toBe('1');
  });

  test('P4: testni o‘chirish → tasdiqlash → toast va ro‘yxatdan yo‘qoladi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('positive delete'));
    await page.goto(routes.placementTests);
    await placementTests.row(id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    await submit(page, `${routes.placementTests}/${id}/delete`, () =>
      page.getByRole('dialog').getByRole('button', { name: 'Oʻchirish' }).click(),
    );
    await expect(toast(page, 'Operatsiya muvaffaqiyatli')).toBeVisible();
    await expect(placementTests.row(id)).toHaveCount(0);
    placementTestsApi.forget(id); // already deleted
  });
});
