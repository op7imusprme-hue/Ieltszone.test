import { Page, Locator, expect } from '@playwright/test';

/** A lead funnel board (Call markaz, Community, Administratsiya). */
export class KanbanBoard {
  constructor(private readonly page: Page, readonly url: string) {}

  async open(search?: string) {
    const query = search ? `?filter[search]=${encodeURIComponent(search)}` : '';
    await this.page.goto(this.url + query);
    await this.page.waitForLoadState('networkidle');
  }

  /** A column (header + its cards) by its title. */
  column(title: string): Locator {
    return this.page
      .locator('div.flex-col.bg-white.rounded-lg')
      .filter({ has: this.page.getByText(title, { exact: true }) })
      .first();
  }

  /** "#id" label of a lead card inside a column. */
  card(column: string, leadId: string): Locator {
    return this.column(column).getByText(`#${leadId}`, { exact: true });
  }

  /** Search a lead on the board and open its card by ID. */
  async openLead(search: string, leadId: string) {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
    const searchInput = this.page.locator('#search');
    if (!(await searchInput.isVisible())) {
      // Call center boards: search icon; Administration board: search inside "Filtrlash"
      const icon = this.page.locator('button:has(svg.ri-search-line)').first();
      if (await icon.isVisible()) await icon.click();
      else await this.page.getByText('Filtrlash', { exact: true }).first().click();
    }
    await searchInput.fill(search);
    // the board reloads after the search request; a card opened before that gets closed again
    const searched = this.page.waitForResponse(r => decodeURIComponent(r.url()).includes('filter[search]='));
    await searchInput.press('Enter');
    await searched;
    await this.page.waitForLoadState('networkidle');
    const card = this.page.getByText(`#${leadId}`, { exact: true }).locator('visible=true').first();
    await expect(card).toBeVisible();
    await card.click();
  }
}
