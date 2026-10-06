import { Page, expect } from '@playwright/test';
import { xsrfHeaders } from '@utils/network';
import { routes } from '@data/routes';

export const COURSE_ID = { 'General English': 1, IELTS: 6 } as const;
export type Course = keyof typeof COURSE_ID;

/**
 * Placement tests over HTTP (same payload as the admin form): fast setup and cleanup.
 * Every created id is tracked; `cleanup()` deletes them (the fixture calls it after each test).
 */
export class PlacementTestsApi {
  private readonly created = new Set<string>();

  constructor(private readonly page: Page) {}

  /** Remember an id created through the UI so it is deleted after the test. */
  track(id: string) {
    this.created.add(id);
    return id;
  }

  /** Already deleted by the test itself. */
  forget(id: string) {
    this.created.delete(id);
  }

  async create(title: string, courses: Course[] = ['General English'], time: string | null = '5:00'): Promise<string> {
    if (!this.page.url().startsWith('http')) await this.page.goto(routes.placementTests);
    const res = await this.page.request.post(routes.placementTests, {
      headers: await xsrfHeaders(this.page),
      data: { title, course_ids: courses.map(c => COURSE_ID[c]), questions_time_limit: time },
      maxRedirects: 0,
    });
    expect(res.status(), 'create placement test').toBe(302);
    const id = res.headers()['location']?.match(/placement-test\/(\d+)/)?.[1];
    expect(id, `redirect to the new test, got ${res.headers()['location']}`).toBeTruthy();
    return this.track(id!);
  }

  async delete(id: string): Promise<number> {
    const res = await this.page.request.delete(`${routes.placementTests}/${id}/delete`, {
      headers: await xsrfHeaders(this.page),
      maxRedirects: 0,
    });
    return res.status();
  }

  async cleanup() {
    for (const id of this.created) {
      const status = await this.delete(id).catch(() => 0);
      if (status >= 400 || status === 0) console.warn(`cleanup: placement test #${id} not deleted (${status})`);
    }
    this.created.clear();
  }
}
