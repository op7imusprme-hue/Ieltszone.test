import { test, expect } from '@fixtures';
import {
  CORRECT_MARK,
  GENERATED_TEST_SECTIONS,
  GENERATED_TEST_STATE,
  GeneratedTest,
} from '@data/placement/generated-test';
import { optionsOf, shouldAnswerCorrectly } from '@pages/public/PlacementTestPage';
import { randomInt } from '@utils/random';
import { state } from '@utils/state';

const LEVELS = GENERATED_TEST_SECTIONS.map(s => s.result);

/**
 * A lead from Administratsiya → "Filialga keldi" takes the test created by new-placement-test.spec.ts.
 * Each run passes a random number of sections (0..5) → the result must be the first section that is not passed.
 * PASSED_SECTIONS=0..5 chooses the level by hand (0 → Beginner, 3 → Intermediate), LEAD_ID=... a specific lead.
 */
test('Placement test level (Filialga keldi → sinov test)', async ({ page, boards, leadCard, publicPlacement }) => {
  test.setTimeout(5 * 60_000);
  const placement = state.read<GeneratedTest>(GENERATED_TEST_STATE);
  expect(placement, 'run new-placement-test.spec.ts first').toBeDefined();
  const { id: testId, title: testTitle } = placement!;
  const passedSections = Number(process.env.PASSED_SECTIONS ?? randomInt(LEVELS.length));
  const expectedLevel = LEVELS[passedSections];
  let leadId = process.env.LEAD_ID ?? '';
  test.info().annotations.push(
    { type: 'placement test', description: `#${testId} ${testTitle}` },
    { type: 'level', description: `${expectedLevel} (${passedSections} sections passed)` },
  );
  const arrived = boards.administration.column('Filialga keldi');

  await test.step('1. Administratsiya → Filialga keldi: lid tanlash', async () => {
    await boards.administration.open();
    if (!leadId) {
      // prefer a test lead (phone "(00) ...") so a real person doesn't get the quiz
      const cards = [...(await arrived.innerText()).matchAll(/#(\d+)\n[\s\S]*?Telefon:\s*(\(\d+\))/g)];
      expect(cards.length, 'no leads in "Filialga keldi"').toBeGreaterThan(0);
      leadId = (cards.find(c => c[2] === '(00)') ?? cards[0])[1];
    }
    test.info().annotations.push({ type: 'lead id', description: leadId });
    await arrived.getByText(`#${leadId}`, { exact: true }).first().click();
    await expect(leadCard.createQuizButton).toBeVisible();
  });

  await test.step(`2. Sinov test yaratish: ${testTitle}`, async () => {
    await leadCard.createQuiz(testTitle, `#${testId} is not offered: remove its empty sections at /admin/placement-test/${testId}`);
  });

  await test.step(`3. Placement test (lead id ${leadId}): ${passedSections} section → ${expectedLevel}`, async () => {
    await publicPlacement.start(leadId);
    await publicPlacement.solve(LEVELS.length, async (question, section, index) => {
      const options = optionsOf(question);
      const correct = question.page().getByText(CORRECT_MARK.trim(), { exact: false });
      const option = shouldAnswerCorrectly(section, index, passedSections)
        ? options.filter({ has: correct })
        : options.filter({ hasNot: correct });
      await option.first().click();
    });
    await publicPlacement.expectLevel(expectedLevel);
  });

  await test.step(`4. Lid chatida "Quiz Result: ${expectedLevel}"`, async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await arrived.getByText(`#${leadId}`, { exact: true }).first().click();
    await leadCard.expectQuizResult(expectedLevel);
  });
});
