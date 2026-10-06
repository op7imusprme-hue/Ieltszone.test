import { Page, expect } from '@playwright/test';
import { fieldBox } from '@components/form';
import { selectOption, visibleOptions } from '@components/multiselect';
import { pickDate } from '@components/datepicker';
import { submit } from '@utils/network';
import { LeadData } from '@data/lead';

/** The lead card (side panel) opened from a board or a chat. */
export class LeadCard {
  readonly nameInput;
  readonly createQuizButton;

  constructor(private readonly page: Page) {
    this.nameInput = page.locator('#name');
    this.createQuizButton = page.getByRole('button', { name: 'Sinov test yaratish' });
  }

  /** "Lidni olish" (PUT /admin/leads/{id}/department/{department}/take). */
  async take(leadId: string) {
    await submit(this.page, new RegExp(`^/admin/leads/${leadId}/department/[^/]+/take$`), () =>
      this.page.getByRole('button', { name: 'Lidni olish' }).click(),
    );
  }

  /** "Saqlash" (PUT /admin/leads/{id}). */
  async save(leadId: string) {
    await submit(this.page, `/admin/leads/${leadId}`, () => this.page.getByRole('button', { name: 'Saqlash' }).click());
  }

  async setFunnel(funnel: string, column: string) {
    await selectOption(this.page, 'lead_funnel_id', funnel);
    await selectOption(this.page, 'lead_column_id', column);
  }

  async setColumn(column: string) {
    await selectOption(this.page, 'lead_column_id', column);
  }

  /** Fill a date field of the card (e.g. details.arrival_date, details.contact_later_on). */
  async setDate(fieldId: string, date: Date) {
    await pickDate(this.page, fieldId, date);
    await expect(this.page.locator(`[id="${fieldId}"]`)).not.toHaveValue('');
  }

  /** Personal and course details (the fields required for Call markaz). */
  async fillDetails(lead: LeadData) {
    await this.nameInput.fill(lead.name);
    await this.page.locator('#surname').fill(lead.surname);
    await this.page.locator('#phone').fill(lead.phone);
    await selectOption(this.page, 'details.who', lead.who);
    await selectOption(this.page, 'details.locale', lead.locale);
    await selectOption(this.page, 'details.gender', lead.gender);
    await this.page.locator('[id="details.age"]').fill(lead.age);
    await selectOption(this.page, 'details.suitable_days', lead.days);
    await selectOption(this.page, 'details.suitable_times', lead.time);
    await this.page.getByText(/KURS HAQIDA/i).first().click(); // close the multi-select
    await selectOption(this.page, 'details.branch', lead.branch);
    await selectOption(this.page, 'details.course', lead.course);
    await selectOption(this.page, 'details.subCourse', lead.subCourse);
  }

  /**
   * "Sinov test yaratish" with the given placement test.
   * The list skips tests with an empty section (e.g. an extra "New section" with 0 questions).
   */
  async createQuiz(testTitle: string, notOfferedHint = `"${testTitle}" is not offered in "Sinov test yaratish"`) {
    await this.createQuizButton.click();
    await fieldBox(this.page, 'assessment_id').locator('.multiselect-wrapper').click();
    const option = visibleOptions(this.page).filter({ hasText: testTitle }).first();
    await expect(option, notOfferedHint).toBeVisible();
    await option.click();
    await this.createQuizButton.last().click();
    await expect(this.page.getByText('Lid uchun quiz generatsiya qilindi').first()).toBeVisible();
  }

  /** The newest quiz result in the lead chat (a lead may have older ones). */
  async expectQuizResult(level: string) {
    await expect(this.page.getByText('Lid quizni yechdi').last()).toBeVisible();
    await expect(this.page.getByText(/Quiz Result:/).last()).toContainText(`Quiz Result: ${level}`);
  }
}
