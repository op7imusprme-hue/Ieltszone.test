import { Page, Locator, expect } from '@playwright/test';
import { env } from '@config/env';

/** Answers one question: `section` and `index` are 0-based. */
export type Answerer = (question: Locator, section: number, index: number) => Promise<void>;

/** Public placement test site: a lead enters its id and takes the test section by section. */
export class PlacementTestPage {
  readonly leadIdInput;
  readonly startButton;
  readonly questions;

  constructor(private readonly page: Page) {
    this.leadIdInput = page.locator('#placement-test-lead-id');
    this.startButton = page.getByRole('button', { name: 'Start the test' });
    this.questions = page.locator('div.rounded-2xl:has(> div > h4):has(form)');
  }

  async open() {
    await this.page.goto(env.placementUrl);
  }

  async start(leadId: string) {
    await this.open();
    await this.leadIdInput.fill(leadId);
    await this.page.locator('button[type=submit]').click();
    await expect(this.page).toHaveURL(/placement-test\/attempt/);
  }

  /** 0-based index of the current section ("SECTION 2 / 6" → 1); an unfinished attempt resumes there. */
  async currentSection(): Promise<number> {
    const label = this.page.getByText(/section \d+ \//i).first();
    await expect(label).toBeVisible();
    return Number((await label.innerText()).match(/\d+/)![0]) - 1;
  }

  /** Answer every question of the remaining sections, then "Finish". */
  async solve(sectionCount: number, answer: Answerer) {
    for (let section = await this.currentSection(); section < sectionCount; section++) {
      await expect(this.page.getByText(new RegExp(`section ${section + 1} /`, 'i'))).toBeVisible();
      await expect(this.questions.first()).toBeVisible();
      const count = await this.questions.count();
      for (let q = 0; q < count; q++) await answer(this.questions.nth(q), section, q);
      await this.page.getByRole('button', { name: section === sectionCount - 1 ? 'Finish' : 'Next' }).click();
    }
  }

  /** Result card: "Your level" followed by the level name. */
  async expectLevel(level: string) {
    await expect(this.page.locator('p', { hasText: /^Your level$/ }).locator('xpath=following-sibling::*[1]')).toHaveText(level);
  }
}

/** Options of a question. */
export const optionsOf = (question: Locator) => question.locator('form > div');

/**
 * Passed section: exactly 4 of 5 correct (the minimum 80%), failed section: all wrong.
 * The student's level is then the first section that is not passed.
 */
export const shouldAnswerCorrectly = (section: number, index: number, passedSections: number) =>
  section < passedSections && index < 4;
