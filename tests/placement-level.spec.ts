import fs from 'fs';
import { test, expect } from '@playwright/test';
import { fieldBox, kanbanColumn } from './helpers';
import { CORRECT_MARK, NEW_PLACEMENT_FILE, NEW_PLACEMENT_SECTIONS } from './new-placement-questions';

const ADMIN_BOARD = '/admin/lead-funnels/administration/leads';
const PLACEMENT_URL = 'https://demo.ieltszoneapp.uz/placement-test';
const LEVELS = NEW_PLACEMENT_SECTIONS.map(s => s.result);

/**
 * A lead from Administratsiya → "Filialga keldi" takes the test created by new-placement-test.spec.ts.
 * Each run passes a random number of sections (0..5) → the result must be the first section that is not passed.
 */
test('Placement test level (Filialga keldi → sinov test)', async ({ page, context }) => {
  test.setTimeout(5 * 60_000);
  expect(fs.existsSync(NEW_PLACEMENT_FILE), 'run new-placement-test.spec.ts first').toBe(true);
  const placement: { id: string; title: string } = JSON.parse(fs.readFileSync(NEW_PLACEMENT_FILE, 'utf8'));
  // PASSED_SECTIONS=0..5 to choose the level by hand: 0 → Beginner, 3 → Intermediate, 5 → IELTS Standard
  const passedSections = Number(process.env.PASSED_SECTIONS ?? Math.floor(Math.random() * LEVELS.length));
  const expectedLevel = LEVELS[passedSections];
  let leadId = process.env.LEAD_ID ?? '';
  test.info().annotations.push(
    { type: 'placement test', description: `#${placement.id} ${placement.title}` },
    { type: 'level', description: `${expectedLevel} (${passedSections} sections passed)` },
  );

  await test.step('1. Administratsiya → Filialga keldi: lid tanlash', async () => {
    await page.goto(ADMIN_BOARD);
    await page.waitForLoadState('networkidle');
    const column = kanbanColumn(page, 'Filialga keldi');
    if (!leadId) {
      // prefer a test lead (phone "(00) ...") so a real person doesn't get the quiz
      const cards = [...(await column.innerText()).matchAll(/#(\d+)\n[\s\S]*?Telefon:\s*(\(\d+\))/g)];
      expect(cards.length, 'no leads in "Filialga keldi"').toBeGreaterThan(0);
      leadId = (cards.find(c => c[2] === '(00)') ?? cards[0])[1];
    }
    test.info().annotations.push({ type: 'lead id', description: leadId });
    await column.getByText(`#${leadId}`, { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Sinov test yaratish' })).toBeVisible();
  });

  await test.step(`2. Sinov test yaratish: ${placement.title}`, async () => {
    await page.getByRole('button', { name: 'Sinov test yaratish' }).click();
    // the list skips tests with an empty section (e.g. an extra "New section" with 0 questions)
    await fieldBox(page, 'assessment_id').locator('.multiselect-wrapper').click();
    const option = page.locator('[role="option"]:visible').filter({ hasText: placement.title });
    await expect(
      option,
      `#${placement.id} is not offered: remove its empty sections at /admin/placement-test/${placement.id}`,
    ).toHaveCount(1);
    await option.click();
    await page.getByRole('button', { name: 'Sinov test yaratish' }).last().click();
    await expect(page.getByText('Lid uchun quiz generatsiya qilindi').first()).toBeVisible();
  });

  await test.step(`3. Placement test (lead id ${leadId}): ${passedSections} section → ${expectedLevel}`, async () => {
    const pt = await context.newPage();
    await pt.goto(PLACEMENT_URL);
    await pt.locator('#placement-test-lead-id').fill(leadId);
    await pt.locator('button[type=submit]').click();
    await expect(pt).toHaveURL(/placement-test\/attempt/);

    for (let section = 0; section < LEVELS.length; section++) {
      await expect(pt.getByText(new RegExp(`section ${section + 1} /`, 'i'))).toBeVisible();
      const questions = pt.locator('div.rounded-2xl:has(> div > h4):has(form)');
      await expect(questions).toHaveCount(5);
      for (let q = 0; q < 5; q++) {
        const options = questions.nth(q).locator('form > div');
        const correct = pt.getByText(CORRECT_MARK.trim(), { exact: false });
        // passed section: exactly 4 correct (the minimum 80%), failed section: all wrong
        const answerCorrectly = section < passedSections && q < 4;
        const option = answerCorrectly ? options.filter({ has: correct }) : options.filter({ hasNot: correct });
        await option.first().click();
      }
      await pt.getByRole('button', { name: section === LEVELS.length - 1 ? 'Finish' : 'Next' }).click();
    }

    // result card: "Your level" followed by the level name
    await expect(pt.locator('p', { hasText: /^Your level$/ }).locator('xpath=following-sibling::*[1]')).toHaveText(expectedLevel);
    await pt.close();
  });

  await test.step(`4. Lid chatida "Quiz Result: ${expectedLevel}"`, async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await kanbanColumn(page, 'Filialga keldi').getByText(`#${leadId}`, { exact: true }).first().click();
    // the lead may have older quiz results: the newest one is the last in the chat
    await expect(page.getByText('Lid quizni yechdi').last()).toBeVisible();
    await expect(page.getByText(/Quiz Result:/).last()).toContainText(`Quiz Result: ${expectedLevel}`);
  });
});
