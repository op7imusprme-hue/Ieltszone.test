import { test, expect } from '@fixtures';
import { GENERATED_TEST_SECTIONS, GENERATED_TEST_STATE, GeneratedTest } from '@data/placement/generated-test';
import { state } from '@utils/state';

// IELTS levels (Boshlang'ich, Standart) are offered only with the IELTS course
const COURSES = ['General English', 'IELTS'];
const QUESTIONS_PER_SECTION = 5;

/**
 * Akademik bo'lim → Placement Tests → New Placement Test: 6 sections × 5 questions.
 * The created test is saved to .state/ for placement-level.spec.ts.
 * Debug: write the sections into an already created test — TEST_ID=239
 */
test('New Placement Test (General English, 6 sections × 5 questions)', async ({ page, placementTests }) => {
  test.setTimeout(10 * 60_000);
  const title = `General English Placement ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  let testId = process.env.TEST_ID ?? '';

  if (!testId) {
    await test.step('1. Akademik bo‘lim → Placement Tests → New Placement Test', async () => {
      await placementTests.openList();
      await page.getByRole('link', { name: 'New Placement Test' }).click();
      await expect(page).toHaveURL(/\/admin\/placement-test\/create$/);
      testId = await placementTests.create(title, COURSES, '5', '0');
      console.log(`Placement test #${testId}: ${title}`);
    });
  }

  for (const [i, section] of GENERATED_TEST_SECTIONS.entries()) {
    await test.step(`${i + 2}. Section ${i + 1}: ${section.level}`, async () => {
      await placementTests.openSection(testId, i);
      await placementTests.fillSection(section);
      await placementTests.saveSection(testId);
    });
  }

  await test.step(`${GENERATED_TEST_SECTIONS.length + 2}. Remove empty sections`, async () => {
    await placementTests.removeEmptySections(testId);
    await expect(placementTests.sectionCards()).toHaveCount(GENERATED_TEST_SECTIONS.length);
  });

  await test.step(`${GENERATED_TEST_SECTIONS.length + 3}. Check the test in the list`, async () => {
    const [, savedTitle, , sections, questions, time] = await placementTests.rowCells(testId);
    expect(sections).toBe(String(GENERATED_TEST_SECTIONS.length));
    expect(questions).toBe(String(GENERATED_TEST_SECTIONS.length * QUESTIONS_PER_SECTION));
    expect(time).toBe('05:00');
    state.write(GENERATED_TEST_STATE, { id: testId, title: savedTitle } satisfies GeneratedTest);
    test.info().annotations.push({ type: 'placement test', description: `#${testId} ${savedTitle}` });
  });
});
