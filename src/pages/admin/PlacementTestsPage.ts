import { Page, Locator, expect } from '@playwright/test';
import { selectOption } from '@components/multiselect';
import { submit } from '@utils/network';
import { routes } from '@data/routes';
import { CORRECT_MARK, PlacementSection } from '@data/placement/generated-test';

const sectionsPath = (testId: string) => new RegExp(`^/admin/placement-test/${testId}/sections`);

/** Akademik bo'lim → Placement Tests: list, create/edit form and test page with its sections. */
export class PlacementTestsPage {
  readonly title;
  readonly minutes;
  readonly seconds;
  readonly saveAndAddSections;
  readonly editSectionLinks;

  constructor(private readonly page: Page) {
    this.title = page.locator('#title');
    this.minutes = page.locator('#placement_time_limit_minutes');
    this.seconds = page.locator('#placement_time_limit_seconds');
    this.saveAndAddSections = page.getByRole('button', { name: 'Save and add sections' });
    this.editSectionLinks = page.getByRole('link', { name: 'Edit section questions' });
  }

  // ── list ──
  async openList() {
    await this.page.goto(routes.placementTests);
  }

  row(id: string): Locator {
    return this.page.locator('tbody tr').filter({ has: this.page.locator(`a[href$="/admin/placement-test/${id}"]`) });
  }

  /** Cells of the list row: ID, title, courses, sections, questions, time limit. */
  async rowCells(id: string): Promise<string[]> {
    await this.openList();
    await expect(this.row(id)).toBeVisible();
    return (await this.row(id).locator('td').allInnerTexts()).map(t => t.trim());
  }

  deleteButton(id: string): Locator {
    return this.row(id).locator('button:has(svg.ri-delete-bin-6-line)');
  }

  // ── create / edit form ──
  async openCreate() {
    await this.page.goto(routes.placementTestCreate);
  }

  /** Pick a course in "Kurslar" and close the list (it covers the Save button). */
  async pickCourse(course: string) {
    await selectOption(this.page, 'course_ids', new RegExp(`^${course}$`));
    await this.page.locator('label[for="course_ids"]').click();
    await expect(this.page.locator('[role="option"]:visible')).toHaveCount(0);
  }

  /** Fill the create form and save it; returns the new id. */
  async create(title: string, courses: string[], minutes: string, seconds: string): Promise<string> {
    await this.openCreate();
    await this.title.fill(title);
    for (const course of courses) await this.pickCourse(course);
    await this.minutes.fill(minutes);
    await this.seconds.fill(seconds);
    await submit(this.page, routes.placementTests, () => this.saveAndAddSections.click());
    await this.page.waitForURL(/\/admin\/placement-test\/\d+$/);
    return this.page.url().match(/placement-test\/(\d+)$/)![1];
  }

  // ── sections ──
  /** "Add section" on the test page → opens the section editor; returns its url. */
  async openNewSection(testId: string): Promise<string> {
    await this.page.goto(routes.placementTest(testId));
    const before = await this.editSectionLinks.count();
    await submit(this.page, sectionsPath(testId), () => this.page.getByRole('button', { name: 'Add section' }).click());
    await expect(this.editSectionLinks).toHaveCount(before + 1);
    await this.editSectionLinks.last().click();
    await expect(this.page).toHaveURL(/\/sections\/[^/]+\/edit$/);
    return this.page.url();
  }

  /** Open the editor of the n-th section (0-based), adding sections until it exists. */
  async openSection(testId: string, index: number) {
    await this.page.goto(routes.placementTest(testId));
    if ((await this.editSectionLinks.count()) <= index) {
      await submit(this.page, sectionsPath(testId), () => this.page.getByRole('button', { name: 'Add section' }).click());
      await expect(this.editSectionLinks).toHaveCount(index + 1);
    }
    await this.editSectionLinks.nth(index).click();
    await expect(this.page).toHaveURL(/\/sections\/[^/]+\/edit$/);
  }

  /** "Add Question" → type; returns the id of the question type select. */
  async addQuestionBlock(): Promise<string> {
    await this.page.getByRole('button', { name: 'Add Question', exact: true }).click();
    const typeLabel = this.page.locator('label[for^="question_type_"]').last();
    return (await typeLabel.getAttribute('for'))!.replace('question_type_', '');
  }

  /** Add a Multiple Choice block; returns its id prefix ("multiple_choice_<block>"). */
  async addMultipleChoice(): Promise<string> {
    const blockId = await this.addQuestionBlock();
    await selectOption(this.page, `question_type_${blockId}`, /^Multiple Choice$/);
    return `multiple_choice_${blockId}`;
  }

  async saveSection(testId: string) {
    await submit(this.page, sectionsPath(testId), () => this.page.getByRole('button', { name: 'Save section' }).click());
  }

  /**
   * Fill a section: title, level and a Multiple Choice block with its questions.
   * The correct option is checked and its text starts with ">> " so it can be spotted while taking the test.
   */
  async fillSection(section: PlacementSection) {
    const page = this.page;
    await this.title.fill(section.title);
    await selectOption(page, 'course_id', new RegExp(`^${section.level}$`));

    const prefix = await this.addMultipleChoice();
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

  /** Remove sections with 0 questions: such a test is not offered in "Sinov test yaratish". */
  async removeEmptySections(testId: string) {
    this.page.on('dialog', d => d.accept());
    await this.page.goto(routes.placementTest(testId));
    const cards = this.sectionCards();
    const empty = cards.filter({ hasText: /Questions:\s*0\b/ });
    while ((await empty.count()) > 0) {
      const before = await cards.count();
      await empty.first().getByRole('button', { name: 'Remove section' }).click();
      await expect(cards).toHaveCount(before - 1);
    }
  }

  sectionCards(): Locator {
    return this.page.locator('div.border-l-4').filter({ has: this.page.getByRole('button', { name: 'Remove section' }) });
  }
}
