import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { MISSING_ID, qaTitle, stamp } from '@data/placement/qa';
import { routes } from '@data/routes';
import { submit, xsrfHeaders } from '@utils/network';

test.describe('Security', () => {
  test('S1: login qilmagan foydalanuvchi admin sahifalariga kira olmaydi', async ({ newPage }) => {
    const page = await newPage({ anonymous: true });
    for (const url of [routes.placementTests, routes.placementTestCreate, `${routes.placementTests}/1`, `${routes.placementTests}/1/edit`]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/admin\/login$/);
    }
  });

  test('S2: login qilmagan foydalanuvchi API orqali test yarata/o‘chira olmaydi', async ({ newPage }) => {
    const page = await newPage({ anonymous: true });
    await page.goto('/admin/login');
    const headers = await xsrfHeaders(page);
    const post = await page.request.post(routes.placementTests, { headers, data: { title: 'AT-QA anon', course_ids: [1] }, maxRedirects: 0 });
    expect(post.headers()['location'] ?? '', 'anon create').not.toMatch(/placement-test\/\d+$/);
    expect([302, 401, 403, 419]).toContain(post.status());
    const del = await page.request.delete(`${routes.placementTests}/1/delete`, { headers, maxRedirects: 0 });
    expect([302, 401, 403, 404, 419]).toContain(del.status());
    if (del.status() === 302) expect(del.headers()['location']).toMatch(/\/admin\/login$/);
  });

  test('S3: CSRF token’siz POST/DELETE → 419, ma’lumot o‘zgarmaydi', async ({ page, placementTests, placementTestsApi }) => {
    const id = await placementTestsApi.create(qaTitle('csrf'));
    const post = await page.request.post(routes.placementTests, { data: { title: 'AT-QA csrf attack', course_ids: [1] }, maxRedirects: 0 });
    expect(post.status()).toBe(419);
    const del = await page.request.delete(`${routes.placementTests}/${id}/delete`, { maxRedirects: 0 });
    expect(del.status()).toBe(419);
    await page.goto(routes.placementTests);
    await expect(placementTests.row(id)).toBeVisible();
  });

  test('S4: XSS — sarlavhadagi HTML/JS bajarilmaydi, matn sifatida ko‘rsatiladi', async ({ page, placementTests, placementTestsApi }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>AT-QA xss ${stamp()}`;
    const id = await placementTestsApi.create(payload);
    await page.goto(routes.placementTests);
    await expect(placementTests.row(id).locator('a').first()).toHaveText(payload);
    await expect(page.locator('tbody img[src="x"], tbody script')).toHaveCount(0);
    await page.goto(`${routes.placementTests}/${id}/edit`);
    await expect(page.locator('#title')).toHaveValue(payload);
    await page.goto(`${routes.placementTests}/${id}`);
    await page.waitForLoadState('networkidle');
    expect(alerted, 'alert() must not fire').toBe(false);
  });

  test('S5: XSS — section sarlavhasi va savol matni bajarilmaydi', async ({ page, placementTests, placementTestsApi }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    const id = await placementTestsApi.create(qaTitle('xss section'));
    await placementTests.openNewSection(id);
    const payload = '<svg onload=alert(1)>XSS';
    await page.locator('#title').fill(payload);
    const prefix = await placementTests.addMultipleChoice();
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill(payload);
    const options = page.locator(`input[id^="${prefix}_option_"]`);
    for (const [i, v] of [payload, 'b', 'c'].entries()) await options.nth(i).fill(v);
    await page.locator(`input[type="radio"][name^="${prefix}_correct_"]`).nth(0).check();
    await submit(page, new RegExp(`^/admin/placement-test/${id}/sections`), () =>
      page.getByRole('button', { name: 'Save section' }).click(),
    );
    await expect(page.getByText(payload).first()).toBeVisible();
    await page.getByRole('link', { name: 'Edit section questions' }).first().click();
    await page.waitForLoadState('networkidle');
    expect(alerted, 'alert() must not fire').toBe(false);
    await expect(page.locator('svg[onload]')).toHaveCount(0);
  });

  test('S6: SQL injection — sarlavha literal saqlanadi, ro‘yxat buzilmaydi', async ({ page, placementTests, placementTestsApi }) => {
    const payload = `AT-QA '; DROP TABLE placement_tests; -- " OR 1=1 ${stamp()}`;
    const id = await placementTestsApi.create(payload);
    const [, title] = await placementTests.rowCells(id);
    expect(title).toBe(payload);
    await expect(page.locator('tbody tr').nth(1)).toBeVisible(); // other tests still listed
  });

  test('S7: noto‘g‘ri ID (SQLi / matn) → 404, stack trace / SQL xatosi oshkor bo‘lmaydi', async ({ page }) => {
    for (const bad of [MISSING_ID, "1'OR'1'='1", 'abc', '-1']) {
      const res = await page.goto(`${routes.placementTests}/${encodeURIComponent(bad)}/edit`);
      expect(res?.status(), bad).toBe(404);
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/SQLSTATE|Exception|Stack trace|vendor\/laravel/i);
    }
  });

  test('S8: public sahifa — SQLi/XSS lead id’dan tozalanadi', async ({ page }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    await page.goto(env.placementUrl);
    const input = page.locator('#placement-test-lead-id');
    await input.fill("1' OR '1'='1");
    await expect(input).toHaveValue('111');
    await input.fill('<script>alert(1)</script>');
    // pasted markup is stripped (tag content included) — only digits, if any, may remain
    await expect(input).toHaveValue(/^\d*$/);
    expect(alerted).toBe(false);
  });

  test('S9: public start API — SQLi payload test ochib bermaydi', async ({ page }) => {
    await page.goto(env.placementUrl);
    const cookie = (await page.context().cookies(env.placementUrl)).find(c => c.name === 'XSRF-TOKEN');
    const res = await page.request.post(`${env.placementUrl}/start`, {
      headers: cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.value), 'X-Requested-With': 'XMLHttpRequest' } : {},
      data: { lead_id: "1 OR 1=1" },
      maxRedirects: 0,
    });
    expect(res.status()).toBeLessThan(500);
    expect(res.headers()['location'] ?? '').not.toMatch(/attempt/);
  });

  test('S10: sessiya cookie HttpOnly+Secure, xavfsizlik headerlari', async ({ page }) => {
    const res = await page.goto(routes.placementTests);
    const headers = res!.headers();
    expect(headers['x-frame-options']).toMatch(/SAMEORIGIN|DENY/i);
    expect(headers['x-content-type-options']).toBe('nosniff');
    const session = (await page.context().cookies()).find(c => /session/i.test(c.name));
    expect(session, 'session cookie').toBeTruthy();
    expect(session!.httpOnly).toBe(true);
    expect(session!.secure).toBe(true);
  });
});
