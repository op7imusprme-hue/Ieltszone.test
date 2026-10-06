import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { fieldError } from '@components/form';
import { qaTitle } from '@data/placement/qa';
import { routes } from '@data/routes';
import { xsrfHeaders } from '@utils/network';

test.describe('Validation', () => {
  test('V1: vaqt maydonlari — type=number, min/max chegaralari', async ({ page }) => {
    await page.goto(routes.placementTestCreate);
    const minutes = page.locator('#placement_time_limit_minutes');
    const seconds = page.locator('#placement_time_limit_seconds');
    await expect(minutes).toHaveAttribute('type', 'number');
    await expect(minutes).toHaveAttribute('min', '0');
    await expect(minutes).toHaveAttribute('max', '9999');
    await expect(seconds).toHaveAttribute('type', 'number');
    await expect(seconds).toHaveAttribute('min', '0');
    await expect(seconds).toHaveAttribute('max', '59');
  });

  test('V2: soniya > 59 → 59 ga tushiriladi', async ({ page, placementTests, placementTestsApi }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill(qaTitle('sec 75'));
    await placementTests.pickCourse('General English');
    await page.locator('#placement_time_limit_minutes').fill('1');
    await page.locator('#placement_time_limit_seconds').fill('75');
    const sent = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === routes.placementTests);
    await placementTests.saveAndAddSections.click();
    expect((await sent).postDataJSON().questions_time_limit).toBe('1:59');
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    placementTestsApi.track(page.url().match(/(\d+)$/)![1]);
  });

  test('V3: manfiy daqiqa saqlanmaydi (manfiy vaqt yuborilmaydi)', async ({ page, placementTests, placementTestsApi }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill(qaTitle('negative minutes'));
    await placementTests.pickCourse('General English');
    await page.locator('#placement_time_limit_minutes').fill('-5');
    await page.locator('#placement_time_limit_seconds').fill('0');
    const sent = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === routes.placementTests);
    await placementTests.saveAndAddSections.click();
    const time: string | null = (await sent).postDataJSON().questions_time_limit;
    expect(time ?? '').not.toContain('-');
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    placementTestsApi.track(page.url().match(/(\d+)$/)![1]);
  });

  test('V4: daqiqa maydoniga harf yozib bo‘lmaydi', async ({ page }) => {
    await page.goto(routes.placementTestCreate);
    const minutes = page.locator('#placement_time_limit_minutes');
    await minutes.click();
    await page.keyboard.type('abc');
    await expect(minutes).toHaveValue('');
  });

  test('V5: faqat bo‘shliqdan iborat sarlavha — "Title is required"', async ({ page, placementTests }) => {
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill('     ');
    await placementTests.pickCourse('General English');
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
  });

  test('V6: server tomoni — sarlavhasiz / kurssiz so‘rov rad etiladi (UI chetlab o‘tilganda)', async ({ page, placementTestsApi }) => {
    await page.goto(routes.placementTests);
    for (const data of [
      { title: '', course_ids: [1], questions_time_limit: '5:00' },
      { title: qaTitle('api no course'), course_ids: [], questions_time_limit: '5:00' },
      { title: qaTitle('api bad course'), course_ids: [987654], questions_time_limit: '5:00' },
      { title: qaTitle('api bad time'), course_ids: [1], questions_time_limit: 'abc' },
    ]) {
      const res = await page.request.post(routes.placementTests, { headers: await xsrfHeaders(page), data, maxRedirects: 0 });
      const location = res.headers()['location'] ?? '';
      const id = location.match(/placement-test\/(\d+)$/)?.[1];
      if (id) placementTestsApi.track(id);
      expect(id, `must be rejected: ${JSON.stringify(data)} → ${res.status()} ${location}`).toBeUndefined();
    }
  });

  test('V7: 256 belgili sarlavha xatosi foydalanuvchiga tushunarli (tarjima kaliti emas)', async ({ page, placementTests }) => {
    test.fail(true, 'BUG: "validation.max.string" kaliti ko‘rsatiladi');
    await page.goto(routes.placementTestCreate);
    await page.locator('#title').fill('AT-QA ' + 'x'.repeat(250));
    await placementTests.pickCourse('General English');
    await placementTests.saveAndAddSections.click();
    await expect(fieldError(page, 'title')).toBeVisible();
    await expect(fieldError(page, 'title')).not.toHaveText(/validation\./);
  });

  test('V8: public lead id — faqat raqam qabul qilinadi', async ({ page }) => {
    await page.goto(env.placementUrl);
    const input = page.locator('#placement-test-lead-id');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('maxlength', '12');
    for (const [typed, expected] of [['abc', ''], ['12ab34', '1234'], ['-7', '7'], ['  ', ''], ['4.5', '45']]) {
      await input.fill(typed);
      await expect(input, `typed "${typed}"`).toHaveValue(expected);
    }
  });
});
