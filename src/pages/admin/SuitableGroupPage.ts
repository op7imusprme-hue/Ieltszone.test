import { Page, expect, test } from '@playwright/test';
import { pickDate, pickDateViaNav } from '@components/datepicker';
import { visibleOptions } from '@components/multiselect';
import { addToGroupButtons, groupIdOfRow } from '@components/table';
import { submit } from '@utils/network';
import { addDays } from '@utils/dates';
import { AUTOTEST_COMMENT, STUDENT_BIRTHDAY } from '@data/lead';
import { routes } from '@data/routes';

/** "Mos guruhga qo'shing": the groups a lead fits, with a "+" per group. */
export class SuitableGroupPage {
  readonly addButtons;

  constructor(private readonly page: Page) {
    this.addButtons = addToGroupButtons(page);
  }

  async open(leadId: string) {
    await this.page.goto(routes.suitableGroups(leadId));
    await this.page.waitForLoadState('networkidle');
  }

  /** If no group fits the lead's level, try the other levels of the dropdown until one has groups. */
  async ensureSomeGroup() {
    const levelSelect = this.page.locator('.multiselect-wrapper:visible').last();
    if ((await this.addButtons.count()) === 0) {
      await levelSelect.click();
      const levels = await visibleOptions(this.page).allInnerTexts();
      await this.page.keyboard.press('Escape');
      for (const level of levels) {
        await levelSelect.click();
        await visibleOptions(this.page).filter({ hasText: level }).first().click();
        await this.page.waitForLoadState('networkidle');
        if ((await this.addButtons.count()) > 0) {
          test.info().annotations.push({ type: 'group level', description: level });
          break;
        }
      }
    }
    await expect(this.addButtons.first(), 'no suitable group for any level').toBeVisible();
  }

  /** "+" on the first group → fill the modal → "Qo'shish". Returns the group id. */
  async addToFirstGroup(leadId: string): Promise<string> {
    await expect(this.addButtons.first()).toBeVisible();
    const groupId = await groupIdOfRow(this.addButtons.first());
    await this.addButtons.first().click();

    await expect(this.page.getByText('Lidni mos guruhga qo`shish')).toBeVisible();
    await pickDate(this.page, 'planned_first_lesson_date', addDays(1));
    await pickDateViaNav(this.page, 'date_of_birth', STUDENT_BIRTHDAY);
    await expect(this.page.locator('#date_of_birth')).not.toHaveValue('');
    await this.page.locator('#comment').fill(AUTOTEST_COMMENT);
    await submit(this.page, `/admin/leads/${leadId}/add-to-suitable-group/${groupId}`, () =>
      this.page.getByRole('button', { name: "Qo'shish", exact: true }).click(),
    );
    return groupId;
  }
}
