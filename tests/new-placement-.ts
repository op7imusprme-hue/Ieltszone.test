import fs from 'fs';
import { test, expect, Page } from '@playwright/test';
import { selectOption, submit } from './helpers';
import {
  CORRECT_MARK,
  NEW_PLACEMENT_FILE,
  NEW_PLACEMENT_SECTIONS,
  PlacementSection,
} from './new-placement-questions';

const COURSES = ['General English', 'IELTS']; // IELTS levels (Boshlang'ich, Standart) are offered only with the IELTS course
const MINUTES = '5';

/**
 * Fill one section: title, level and a Multiple Choice block with its questions.
 * The correct option is checked and its text starts with ">> " so it can be spotted while taking the test.
 */
async function fillSection(page: Page, section: PlacementSection) {
  await page.locator('#title').fill(section.title);
  await selectOption(page, 'course_id', new RegExp(`^${section.level}$`));

  await page.getByRole('button', { name: 'Add Question', exact: true }).click();
  const typeLabel = page.locator('label[for^="question_type_"]').last();
  const blockId = (await typeLabel.getAttribute('for'))!.replace('question_type_', '');
  await selectOption(page, `question_type_${blockId}`, /^Multiple Choice$/);

  const prefix = `multiple_choice_${blockId}`;
  await page.locator(`[id="${prefix}_title"]`).fill(section.title);
  const questions = page.locator(`textarea[id^="${prefix}_question_"]`);

  for (const [i, q] of section.questions.entries()) {
    if (i > 0) {
      await page.getByRole('button', { name: 'Add question', exact: true }).last().click();
      await expect(questions).toHaveCount(i + 1);
    }
    const textarea = questions.nth(i);
    await textarea.fill(q.text);
    const questionId = (await textarea.getAttribute('id'))!.replace(`${prefix}_question_`, '');
    const article = page.locator('article').filter({ has: page.locator(`[id="${prefix}_question_${questionId}"]`) });
    const options = article.locator(`input[id^="${prefix}_option_${questionId}_"]`);
    while ((await options.count()) < q.options.length) {
      const count = await options.count();
      await article.getByRole('button', { name: 'Add options' }).click();
      await expect(options).toHaveCount(count + 1);
    }
    for (const [j, option] of q.options.entries()) {
      await options.nth(j).fill(option === q.answer ? CORRECT_MARK + option : option);
    }
    // the green check next to the correct option
    const correct = q.options.indexOf(q.answer);
    await article.locator(`input[type="radio"][name="${prefix}_correct_${questionId}"]`).nth(correct).check();
  }
}

test('New Placement Test (General English, 6 sections × 5 questions)', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const title = `General English Placement ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  // Debug: continue an already created test, e.g. TEST_ID=239
  let testId = process.env.TEST_ID ?? '';

  if (!testId) await test.step('1. Akademik bo‘lim → Placement Tests → New Placement Test', async () => {
    await page.goto('/admin/placement-test');
    await page.getByRole('link', { name: 'New Placement Test' }).click();
    await expect(page).toHaveURL(/\/admin\/placement-test\/create$/);
    await page.locator('#title').fill(title);
    for (const course of COURSES) await selectOption(page, 'course_ids', new RegExp(`^${course}$`));
    await page.locator('#placement_time_limit_minutes').fill(MINUTES);
    await page.locator('#placement_time_limit_seconds').fill('0');
    await submit(page, '/admin/placement-test', () => page.getByRole('button', { name: 'Save and add sections' }).click());
    await page.waitForURL(/\/admin\/placement-test\/\d+/);
    testId = page.url().match(/placement-test\/(\d+)/)![1];
    console.log(`Placement test #${testId}: ${title}`);
  });

  for (const [i, section] of NEW_PLACEMENT_SECTIONS.entries()) {
    await test.step(`${i + 2}. Section ${i + 1}: ${section.level}`, async () => {
      await page.goto(`/admin/placement-test/${testId}`);
      const editLinks = page.getByRole('link', { name: 'Edit section questions' });
      if ((await editLinks.count()) <= i) {
        await submit(page, new RegExp(`^/admin/placement-test/${testId}/sections`), () =>
          page.getByRole('button', { name: 'Add section' }).click(),
        );
        await expect(editLinks).toHaveCount(i + 1);
      }
      await editLinks.nth(i).click();
      await expect(page).toHaveURL(/\/sections\/[^/]+\/edit$/);
      await fillSection(page, section);
      await submit(page, new RegExp(`^/admin/placement-test/${testId}/sections`), () =>
        page.getByRole('button', { name: 'Save section' }).click(),
      );
    });
  }

  await test.step(`${NEW_PLACEMENT_SECTIONS.length + 2}. Remove empty sections`, async () => {
    // a test with an empty "No level" section is not offered in "Sinov test yaratish"
    page.on('dialog', d => d.accept());
    await page.goto(`/admin/placement-test/${testId}`);
    const cards = page.locator('div.border-l-4').filter({ has: page.getByRole('button', { name: 'Remove section' }) });
    const empty = cards.filter({ hasText: /Questions:\s*0\b/ });
    while ((await empty.count()) > 0) {
      const before = await cards.count();
      await empty.first().getByRole('button', { name: 'Remove section' }).click();
      await expect(cards).toHaveCount(before - 1);
    }
    await expect(cards).toHaveCount(NEW_PLACEMENT_SECTIONS.length);
  });

  await test.step(`${NEW_PLACEMENT_SECTIONS.length + 3}. Check the test in the list`, async () => {
    await page.goto('/admin/placement-test');
    const row = page.locator('tr').filter({ has: page.locator(`a[href$="/admin/placement-test/${testId}"]`) });
    const cells = row.locator('td');
    // columns: ID, Sarlavha, Kurslar, Sections, Questions, Time limit
    await expect(cells.nth(3)).toHaveText(String(NEW_PLACEMENT_SECTIONS.length));
    await expect(cells.nth(4)).toHaveText(String(NEW_PLACEMENT_SECTIONS.length * 5));
    await expect(cells.nth(5)).toHaveText('05:00');
    // placement-level.spec.ts takes this test for a lead
    const savedTitle = (await row.locator('a').first().innerText()).trim();
    fs.writeFileSync(NEW_PLACEMENT_FILE, JSON.stringify({ id: testId, title: savedTitle }, null, 2) + '\n');
  });
});
