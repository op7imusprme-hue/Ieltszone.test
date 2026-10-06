import { test, expect, Page, Browser } from '@playwright/test';
import { selectOption, submit } from './helpers';

/**
 * Akademik bo'lim → Placement Tests: test-case'lar.
 * Positive / Negative / Edge / UI-UX / Validation / Security.
 *
 * Har bir test o'zi yaratgan placement testlarni (sarlavhasi "AT-QA" bilan boshlanadi) afterEach'da o'chiradi.
 * Saytdagi ma'lum xatolar `test.fail()` bilan belgilangan: xato tuzatilsa, test qizil bo'lib xabar beradi.
 */

const LIST = '/admin/placement-test';
const CREATE = '/admin/placement-test/create';
const PUBLIC_START = 'https://demo.ieltszoneapp.uz/placement-test';
const COURSE_ID = { 'General English': 1, IELTS: 6 } as const;
const MISSING_ID = '99999999';

let created: string[] = [];

const stamp = () => new Date().toISOString().slice(5, 19).replace('T', ' ');
const qaTitle = (name: string) => `AT-QA ${name} ${stamp()}`;

const row = (page: Page, id: string) =>
  page.locator('tbody tr').filter({ has: page.locator(`a[href$="/admin/placement-test/${id}"]`) });
const toast = (page: Page, text: string | RegExp) =>
  page.locator('.Vue-Toastification__toast').filter({ hasText: text }).first();
const fieldError = (page: Page, id: string) => page.locator(`[id="${id}-error"]`);
const saveTestButton = (page: Page) => page.getByRole('button', { name: 'Save and add sections' });

/** Headers of a state-changing request as the Laravel app expects them (CSRF from the XSRF-TOKEN cookie). */
async function xsrfHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find(c => c.name === 'XSRF-TOKEN');
  expect(cookie, 'XSRF-TOKEN cookie').toBeTruthy();
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie!.value), 'X-Requested-With': 'XMLHttpRequest' };
}

/** Fast setup: create a placement test via HTTP (same payload as the form). */
async function createViaApi(
  page: Page,
  title: string,
  courses: (keyof typeof COURSE_ID)[] = ['General English'],
  time: string | null = '5:00',
) {
  if (!page.url().startsWith('http')) await page.goto(LIST);
  const res = await page.request.post(LIST, {
    headers: await xsrfHeaders(page),
    data: { title, course_ids: courses.map(c => COURSE_ID[c]), questions_time_limit: time },
    maxRedirects: 0,
  });
  expect(res.status(), 'create placement test').toBe(302);
  const id = res.headers()['location']?.match(/placement-test\/(\d+)/)?.[1];
  expect(id, `redirect to the new test, got ${res.headers()['location']}`).toBeTruthy();
  created.push(id!);
  return id!;
}

/** Pick a course in the "Kurslar" multiselect and close it (the open list covers the Save button). */
async function pickCourse(page: Page, course: string) {
  await selectOption(page, 'course_ids', new RegExp(`^${course}$`));
  await page.locator('label[for="course_ids"]').click();
  await expect(page.locator('[role="option"]:visible')).toHaveCount(0);
}

/** Fill the create form and save it through the UI; returns the new id. */
async function createViaUi(page: Page, title: string, courses: string[], minutes: string, seconds: string) {
  await page.goto(CREATE);
  await page.locator('#title').fill(title);
  for (const course of courses) await pickCourse(page, course);
  await page.locator('#placement_time_limit_minutes').fill(minutes);
  await page.locator('#placement_time_limit_seconds').fill(seconds);
  await submit(page, LIST, () => saveTestButton(page).click());
  await page.waitForURL(/\/admin\/placement-test\/\d+$/);
  const id = page.url().match(/placement-test\/(\d+)$/)![1];
  created.push(id);
  return id;
}

async function deleteViaApi(page: Page, id: string) {
  const res = await page.request.delete(`${LIST}/${id}/delete`, { headers: await xsrfHeaders(page), maxRedirects: 0 });
  return res.status();
}

/** Open the list row of a test (cells: ID, title, courses, sections, questions, time limit). */
async function rowCells(page: Page, id: string) {
  await page.goto(LIST);
  await expect(row(page, id)).toBeVisible();
  return (await row(page, id).locator('td').allInnerTexts()).map(t => t.trim());
}

/** "Add section" on the test page → opens the section editor; returns its url. */
async function openNewSection(page: Page, id: string) {
  await page.goto(`${LIST}/${id}`);
  const editLinks = page.getByRole('link', { name: 'Edit section questions' });
  const before = await editLinks.count();
  await submit(page, new RegExp(`^/admin/placement-test/${id}/sections`), () =>
    page.getByRole('button', { name: 'Add section' }).click(),
  );
  await expect(editLinks).toHaveCount(before + 1);
  await editLinks.last().click();
  await expect(page).toHaveURL(/\/sections\/[^/]+\/edit$/);
  return page.url();
}

/** Add a question block of the given type in the section editor; returns its prefix for ids. */
async function addMultipleChoice(page: Page) {
  await page.getByRole('button', { name: 'Add Question', exact: true }).click();
  const blockId = (await page.locator('label[for^="question_type_"]').last().getAttribute('for'))!.replace('question_type_', '');
  await selectOption(page, `question_type_${blockId}`, /^Multiple Choice$/);
  return `multiple_choice_${blockId}`;
}

test.beforeEach(() => {
  created = [];
});

test.afterEach(async ({ page }) => {
  for (const id of created) {
    const status = await deleteViaApi(page, id).catch(() => 0);
    if (status >= 400 || status === 0) console.warn(`cleanup: placement test #${id} not deleted (${status})`);
  }
});

// ───────────────────────────── POSITIVE ─────────────────────────────
test.describe('Positive', () => {
  test('P1: yangi placement test yaratish (2 kurs, 5:00) → ro‘yxatda chiqadi', async ({ page }) => {
    const title = qaTitle('positive create');
    const id = await createViaUi(page, title, ['General English', 'IELTS'], '5', '0');
    await expect(page.getByText('Sections (0)')).toBeVisible();

    const [cellId, cellTitle, courses, sections, questions, time] = await rowCells(page, id);
    expect(cellId).toBe(id);
    expect(cellTitle).toBe(title);
    expect(courses).toBe('General English, IELTS');
    expect(sections).toBe('0');
    expect(questions).toBe('0');
    expect(time).toBe('05:00');
  });

  test('P2: testni tahrirlash — sarlavha, kurs va vaqt yangilanadi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('positive edit'));
    const newTitle = qaTitle('positive edited');
    await page.goto(LIST);
    await row(page, id).locator(`a[href$="/admin/placement-test/${id}/edit"]`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/placement-test/${id}/edit$`));
    await page.locator('#title').fill(newTitle);
    await pickCourse(page, 'IELTS');
    await page.locator('#placement_time_limit_minutes').fill('12');
    await page.locator('#placement_time_limit_seconds').fill('30');
    await submit(page, `${LIST}/${id}`, () => page.getByRole('button', { name: 'Saqlash' }).click());

    const [, title, courses, , , time] = await rowCells(page, id);
    expect(title).toBe(newTitle);
    expect(courses).toContain('IELTS');
    expect(time).toBe('12:30');
  });

  test('P3: section + Multiple Choice savol (4 variant, to‘g‘ri javob belgilangan) saqlanadi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('positive section'), ['General English', 'IELTS']);
    await openNewSection(page, id);
    await page.locator('#title').fill('A1 Beginner');
    await selectOption(page, 'course_id', /^Beginner$/);
    const prefix = await addMultipleChoice(page);
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('She ______ a teacher.');
    const article = page.locator('article').filter({ has: page.locator(`textarea[id^="${prefix}_question_"]`) });
    const options = article.locator(`input[id^="${prefix}_option_"]`);
    await article.getByRole('button', { name: 'Add options' }).click();
    await expect(options).toHaveCount(4);
    for (const [i, v] of ['am', 'is', 'are', 'be'].entries()) await options.nth(i).fill(v);
    await article.locator(`input[type="radio"][name^="${prefix}_correct_"]`).nth(1).check();
    await submit(page, new RegExp(`^/admin/placement-test/${id}/sections`), () =>
      page.getByRole('button', { name: 'Save section' }).click(),
    );
    await expect(page).toHaveURL(new RegExp(`/admin/placement-test/${id}$`));
    await expect(page.getByText('Sections (1)')).toBeVisible();

    const [, , , sections, questions] = await rowCells(page, id);
    expect(sections).toBe('1');
    expect(questions).toBe('1');
  });

  test('P4: testni o‘chirish → tasdiqlash → toast va ro‘yxatdan yo‘qoladi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('positive delete'));
    await page.goto(LIST);
    await row(page, id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    await submit(page, `${LIST}/${id}/delete`, () =>
      page.getByRole('dialog').getByRole('button', { name: 'Oʻchirish' }).click(),
    );
    await expect(toast(page, 'Operatsiya muvaffaqiyatli')).toBeVisible();
    await expect(row(page, id)).toHaveCount(0);
    created = []; // already deleted
  });
});

// ───────────────────────────── NEGATIVE ─────────────────────────────
test.describe('Negative', () => {
  test('N1: bo‘sh forma saqlanmaydi — sarlavha va kurs xatolari, so‘rov yuborilmaydi', async ({ page }) => {
    await page.goto(CREATE);
    let posted = false;
    page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === LIST) posted = true; });
    await saveTestButton(page).click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
    await expect(fieldError(page, 'course_ids')).toHaveText('Choose at least one course');
    await expect(page).toHaveURL(new RegExp(`${CREATE}$`));
    expect(posted, 'invalid form must not be sent').toBe(false);
  });

  test('N2: kurs tanlanmasa saqlanmaydi', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('#title').fill(qaTitle('no course'));
    await saveTestButton(page).click();
    await expect(fieldError(page, 'course_ids')).toHaveText('Choose at least one course');
    await expect(page).toHaveURL(new RegExp(`${CREATE}$`));
  });

  test('N3: sarlavhasiz (faqat kurs bilan) saqlanmaydi', async ({ page }) => {
    await page.goto(CREATE);
    await pickCourse(page, 'General English');
    await saveTestButton(page).click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
    await expect(page).toHaveURL(new RegExp(`${CREATE}$`));
  });

  test('N4: o‘chirishni bekor qilish — test qoladi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('delete cancel'));
    await page.goto(LIST);
    await row(page, id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.reload();
    await expect(row(page, id)).toBeVisible();
  });

  test('N5: section sarlavhasiz saqlanmaydi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('section no title'));
    const url = await openNewSection(page, id);
    await page.locator('#title').fill('');
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(fieldError(page, 'title')).toHaveText('Section title is required');
    expect(page.url()).toBe(url);
  });

  test('N6: Multiple Choice savol matnisiz saqlanmaydi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('question no text'));
    const url = await openNewSection(page, id);
    await page.locator('#title').fill('S1');
    await addMultipleChoice(page);
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(toast(page, 'Question 1: this question needs its own text.')).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('N7: to‘g‘ri javob belgilanmasa saqlanmaydi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('no correct option'));
    const url = await openNewSection(page, id);
    await page.locator('#title').fill('S1');
    const prefix = await addMultipleChoice(page);
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('Question?');
    const options = page.locator(`input[id^="${prefix}_option_"]`);
    for (const [i, v] of ['a', 'b', 'c'].entries()) await options.nth(i).fill(v);
    await page.getByRole('button', { name: 'Save section' }).click();
    await expect(toast(page, 'Question 1: select the correct option.')).toBeVisible();
    expect(page.url()).toBe(url);
    const [, , , , questions] = await rowCells(page, id);
    expect(questions).toBe('0');
  });

  test('N8: mavjud bo‘lmagan placement test → 404', async ({ page }) => {
    const res = await page.goto(`${LIST}/${MISSING_ID}/edit`);
    expect(res?.status()).toBe(404);
  });

  test('N9: public sahifa — mavjud bo‘lmagan lead id bilan test boshlanmaydi', async ({ page }) => {
    await page.goto(PUBLIC_START);
    await page.locator('#placement-test-lead-id').fill(MISSING_ID);
    await page.getByRole('button', { name: 'Start the test' }).click();
    await expect(page.getByText('No placement test is available for this lead id.').first()).toBeVisible();
    await expect(page).not.toHaveURL(/attempt/);
  });
});

// ───────────────────────────── EDGE CASES ─────────────────────────────
test.describe('Edge cases', () => {
  test('E1: sarlavha 255 belgi (chegaraviy maksimum) qabul qilinadi', async ({ page }) => {
    const title = ('AT-QA ' + 'x'.repeat(255)).slice(0, 255);
    const id = await createViaUi(page, title, ['General English'], '5', '0');
    const [, savedTitle] = await rowCells(page, id);
    expect(savedTitle).toBe(title);
  });

  test('E2: sarlavha 256 belgi (max+1) rad etiladi', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('#title').fill('AT-QA ' + 'x'.repeat(250));
    await pickCourse(page, 'General English');
    await saveTestButton(page).click();
    await expect(fieldError(page, 'title')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${CREATE}$`));
  });

  test('E3: vaqt 0:00 → cheklovsiz test ("—")', async ({ page }) => {
    const id = await createViaUi(page, qaTitle('zero time'), ['General English'], '0', '0');
    const [, , , , , time] = await rowCells(page, id);
    expect(time).toBe('—');
  });

  test('E4: vaqt bo‘sh → cheklovsiz test ("—")', async ({ page }) => {
    const id = await createViaUi(page, qaTitle('empty time'), ['General English'], '', '');
    const [, , , , , time] = await rowCells(page, id);
    expect(time).toBe('—');
  });

  test('E5: 0 daqiqa 59 soniya (soniya maksimumi) → 00:59', async ({ page }) => {
    const id = await createViaUi(page, qaTitle('59 sec'), ['General English'], '0', '59');
    const [, , , , , time] = await rowCells(page, id);
    expect(time).toBe('00:59');
  });

  test('E6: Unicode / kirill / emoji sarlavha o‘zgarishsiz saqlanadi', async ({ page }) => {
    const title = `AT-QA Ўзбекча тест ğüşö 日本語 🎓 ${stamp()}`;
    const id = await createViaUi(page, title, ['General English'], '5', '0');
    const [, savedTitle] = await rowCells(page, id);
    expect(savedTitle).toBe(title);
  });

  test('E7: bitta savolda 2 ta variant (minimum) bilan saqlanadi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('min options'));
    await openNewSection(page, id);
    await page.locator('#title').fill('S1');
    const prefix = await addMultipleChoice(page);
    await page.locator(`textarea[id^="${prefix}_question_"]`).first().fill('True or false?');
    const options = page.locator(`input[id^="${prefix}_option_"]`);
    await options.nth(0).fill('True');
    await options.nth(1).fill('False');
    await page.locator(`input[type="radio"][name^="${prefix}_correct_"]`).nth(0).check();
    await page.getByRole('button', { name: 'Save section' }).click();
    // either saved (1 question) or rejected with a toast about the empty 3rd option — never a crash
    await expect(page.locator('.Vue-Toastification__toast').or(page.getByText('Sections (1)')).first()).toBeVisible();
  });

  test('E8: public lead id — 12 belgidan uzun kiritib bo‘lmaydi', async ({ page }) => {
    await page.goto(PUBLIC_START);
    const input = page.locator('#placement-test-lead-id');
    await input.fill('1234567890123456');
    await expect(input).toHaveValue('123456789012');
  });

  test('E9: public lead id = 0 → tushunarli xabar (tarjima kaliti emas)', async ({ page }) => {
    test.fail(true, 'BUG: server "validation.min.numeric" kalitini ko‘rsatadi');
    await page.goto(PUBLIC_START);
    await page.locator('#placement-test-lead-id').fill('0');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/placement-test/start') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Start the test' }).click(),
    ]);
    await page.waitForLoadState('networkidle');
    // static "Enter the lead id…" text must not satisfy this — wait for the real error message
    await expect(page.getByText(/validation\.|No placement test|not found|invalid|must be/i).first()).toBeVisible();
    await expect(page.getByText(/validation\.\w+/)).toHaveCount(0);
  });
});

// ───────────────────────────── UI / UX ─────────────────────────────
test.describe('UI/UX', () => {
  test('U1: ro‘yxat sahifasi — sarlavha, ustunlar, "New Placement Test" tugmasi', async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByRole('heading', { name: 'Placement Tests' }).or(page.getByText('Placement Tests', { exact: true })).first()).toBeVisible();
    const headers = (await page.locator('thead th').allInnerTexts()).map(t => t.trim().toUpperCase()).filter(Boolean);
    expect(headers).toEqual(['ID', 'SARLAVHA', 'KURSLAR', 'SECTIONS', 'QUESTIONS', 'TIME LIMIT', 'HARAKATLAR']);
    await page.getByRole('link', { name: 'New Placement Test' }).click();
    await expect(page).toHaveURL(new RegExp(`${CREATE}$`));
  });

  test('U2: yaratish formasi — label, placeholder, maslahat matni, tugmalar', async ({ page }) => {
    await page.goto(CREATE);
    await expect(page.locator('label[for="title"]')).toHaveText('Sarlavha');
    await expect(page.locator('label[for="course_ids"]')).toHaveText('Kurslar');
    await expect(page.locator('#title')).toHaveAttribute('placeholder', 'Placement test title');
    await expect(page.getByText('Time limit', { exact: true })).toBeVisible();
    await expect(page.locator('label[for="placement_time_limit_minutes"]')).toHaveText('Minutes');
    await expect(page.locator('label[for="placement_time_limit_seconds"]')).toHaveText('Seconds');
    await expect(page.getByText('Save the placement test first, then add its sections.')).toBeVisible();
    await expect(saveTestButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Bekor qilish' })).toBeVisible();
  });

  test('U3: kurslar dropdown — General English, IELTS, CEFR bor', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('[data-field="course_ids"] .multiselect-wrapper').click();
    const options = page.locator('[role="option"]:visible');
    for (const course of ['General English', 'IELTS', 'CEFR']) await expect(options.filter({ hasText: course })).toHaveCount(1);
  });

  test('U4: "Bekor qilish" va "Orqaga" ro‘yxatga qaytaradi', async ({ page }) => {
    await page.goto(CREATE);
    await page.getByRole('button', { name: 'Bekor qilish' }).click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
    await page.goto(CREATE);
    await page.getByText('Orqaga', { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  });

  test('U5: xato maydon qizil + aria-invalid, matn kiritilgach xato yo‘qoladi', async ({ page }) => {
    await page.goto(CREATE);
    await saveTestButton(page).click();
    const title = page.locator('#title');
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(title).toHaveAttribute('aria-describedby', 'title-error');
    await expect(title).toHaveClass(/border-red/);
    await title.fill('AT-QA something');
    await pickCourse(page, 'General English');
    await page.locator('#placement_time_limit_minutes').click();
    await saveTestButton(page).click().catch(() => {});
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    created.push(page.url().match(/(\d+)$/)![1]);
    await expect(fieldError(page, 'title')).toHaveCount(0);
  });

  test('U6: o‘chirish dialogi — ogohlantirish matni va 2 ta tugma', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('delete dialog'));
    await page.goto(LIST);
    await row(page, id).locator('button:has(svg.ri-delete-bin-6-line)').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete placement test')).toBeVisible();
    await expect(dialog).toContainText('This action cannot be undone.');
    await expect(dialog.getByRole('button', { name: 'Oʻchirish' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Bekor qilish' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('U7: tahrirlash formasi mavjud qiymatlar bilan ochiladi', async ({ page }) => {
    const title = qaTitle('edit prefill');
    const id = await createViaApi(page, title, ['General English'], '7:45');
    await page.goto(`${LIST}/${id}/edit`);
    await expect(page.locator('#title')).toHaveValue(title);
    await expect(page.locator('[data-field="course_ids"]')).toContainText('General English');
    await expect(page.locator('#placement_time_limit_minutes')).toHaveValue('7');
    await expect(page.locator('#placement_time_limit_seconds')).toHaveValue('45');
    await expect(page.getByRole('button', { name: 'Saqlash' })).toBeVisible();
  });

  test('U8: section editor — savol turlari ro‘yxati', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('question types'));
    await openNewSection(page, id);
    await page.getByRole('button', { name: 'Add Question', exact: true }).click();
    const blockId = (await page.locator('label[for^="question_type_"]').last().getAttribute('for'))!.replace('question_type_', '');
    await page.locator(`xpath=//label[@for="question_type_${blockId}"]/../following-sibling::*[1]`).locator('.multiselect-wrapper').click();
    const types = (await page.locator('[role="option"]:visible').allInnerTexts()).map(t => t.trim());
    expect(types).toEqual(expect.arrayContaining([
      'Completion', 'Multiple Choice', 'Multi Select', 'Matching Features', 'Sentence Reordering', 'Writing',
    ]));
  });

  test('U9: mobil (375px) — gorizontal scroll yo‘q', async ({ browser }) => {
    const ctx = await browser.newContext({
      baseURL: 'https://demo-main.ieltszoneapp.uz',
      storageState: '.auth/ceo.json',
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(CREATE);
    await expect(page.locator('#title')).toBeVisible();
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(width);
    await ctx.close();
  });

  test('U10: public sahifa — bo‘sh lead id’da "Start the test" o‘chiq, kiritilganda yoqiladi', async ({ page }) => {
    await page.goto(PUBLIC_START);
    const input = page.locator('#placement-test-lead-id');
    const start = page.getByRole('button', { name: 'Start the test' });
    await expect(input).toBeFocused(); // autofocus
    await expect(input).toHaveAttribute('placeholder', /For example/);
    await expect(start).toBeDisabled();
    await input.fill('123');
    await expect(start).toBeEnabled();
    await input.fill('');
    await expect(start).toBeDisabled();
  });
});

// ───────────────────────────── VALIDATION ─────────────────────────────
test.describe('Validation', () => {
  test('V1: vaqt maydonlari — type=number, min/max chegaralari', async ({ page }) => {
    await page.goto(CREATE);
    const minutes = page.locator('#placement_time_limit_minutes');
    const seconds = page.locator('#placement_time_limit_seconds');
    await expect(minutes).toHaveAttribute('type', 'number');
    await expect(minutes).toHaveAttribute('min', '0');
    await expect(minutes).toHaveAttribute('max', '9999');
    await expect(seconds).toHaveAttribute('type', 'number');
    await expect(seconds).toHaveAttribute('min', '0');
    await expect(seconds).toHaveAttribute('max', '59');
  });

  test('V2: soniya > 59 → 59 ga tushiriladi', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('#title').fill(qaTitle('sec 75'));
    await pickCourse(page, 'General English');
    await page.locator('#placement_time_limit_minutes').fill('1');
    await page.locator('#placement_time_limit_seconds').fill('75');
    const sent = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === LIST);
    await saveTestButton(page).click();
    expect((await sent).postDataJSON().questions_time_limit).toBe('1:59');
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    created.push(page.url().match(/(\d+)$/)![1]);
  });

  test('V3: manfiy daqiqa saqlanmaydi (manfiy vaqt yuborilmaydi)', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('#title').fill(qaTitle('negative minutes'));
    await pickCourse(page, 'General English');
    await page.locator('#placement_time_limit_minutes').fill('-5');
    await page.locator('#placement_time_limit_seconds').fill('0');
    const sent = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === LIST);
    await saveTestButton(page).click();
    const time: string | null = (await sent).postDataJSON().questions_time_limit;
    expect(time ?? '').not.toContain('-');
    await page.waitForURL(/\/admin\/placement-test\/\d+$/);
    created.push(page.url().match(/(\d+)$/)![1]);
  });

  test('V4: daqiqa maydoniga harf yozib bo‘lmaydi', async ({ page }) => {
    await page.goto(CREATE);
    const minutes = page.locator('#placement_time_limit_minutes');
    await minutes.click();
    await page.keyboard.type('abc');
    await expect(minutes).toHaveValue('');
  });

  test('V5: faqat bo‘shliqdan iborat sarlavha — "Title is required"', async ({ page }) => {
    await page.goto(CREATE);
    await page.locator('#title').fill('     ');
    await pickCourse(page, 'General English');
    await saveTestButton(page).click();
    await expect(fieldError(page, 'title')).toHaveText('Title is required');
  });

  test('V6: server tomoni — sarlavhasiz / kurssiz so‘rov rad etiladi (UI chetlab o‘tilganda)', async ({ page }) => {
    await page.goto(LIST);
    for (const data of [
      { title: '', course_ids: [1], questions_time_limit: '5:00' },
      { title: qaTitle('api no course'), course_ids: [], questions_time_limit: '5:00' },
      { title: qaTitle('api bad course'), course_ids: [987654], questions_time_limit: '5:00' },
      { title: qaTitle('api bad time'), course_ids: [1], questions_time_limit: 'abc' },
    ]) {
      const res = await page.request.post(LIST, { headers: await xsrfHeaders(page), data, maxRedirects: 0 });
      const location = res.headers()['location'] ?? '';
      const id = location.match(/placement-test\/(\d+)$/)?.[1];
      if (id) created.push(id);
      expect(id, `must be rejected: ${JSON.stringify(data)} → ${res.status()} ${location}`).toBeUndefined();
    }
  });

  test('V7: 256 belgili sarlavha xatosi foydalanuvchiga tushunarli (tarjima kaliti emas)', async ({ page }) => {
    test.fail(true, 'BUG: "validation.max.string" kaliti ko‘rsatiladi');
    await page.goto(CREATE);
    await page.locator('#title').fill('AT-QA ' + 'x'.repeat(250));
    await pickCourse(page, 'General English');
    await saveTestButton(page).click();
    await expect(fieldError(page, 'title')).toBeVisible();
    await expect(fieldError(page, 'title')).not.toHaveText(/validation\./);
  });

  test('V8: public lead id — faqat raqam qabul qilinadi', async ({ page }) => {
    await page.goto(PUBLIC_START);
    const input = page.locator('#placement-test-lead-id');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('maxlength', '12');
    for (const [typed, expected] of [['abc', ''], ['12ab34', '1234'], ['-7', '7'], ['  ', ''], ['4.5', '45']]) {
      await input.fill(typed);
      await expect(input, `typed "${typed}"`).toHaveValue(expected);
    }
  });
});

// ───────────────────────────── SECURITY ─────────────────────────────
test.describe('Security', () => {
  async function anonPage(browser: Browser) {
    const ctx = await browser.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: { cookies: [], origins: [] } });
    return ctx.newPage();
  }

  test('S1: login qilmagan foydalanuvchi admin sahifalariga kira olmaydi', async ({ browser }) => {
    const page = await anonPage(browser);
    for (const url of [LIST, CREATE, `${LIST}/1`, `${LIST}/1/edit`]) {
      await page.goto(url);
      await expect(page, url).toHaveURL(/\/admin\/login$/);
    }
    await page.context().close();
  });

  test('S2: login qilmagan foydalanuvchi API orqali test yarata/o‘chira olmaydi', async ({ browser }) => {
    const page = await anonPage(browser);
    await page.goto('/admin/login');
    const headers = await xsrfHeaders(page);
    const post = await page.request.post(LIST, { headers, data: { title: 'AT-QA anon', course_ids: [1] }, maxRedirects: 0 });
    expect(post.headers()['location'] ?? '', 'anon create').not.toMatch(/placement-test\/\d+$/);
    expect([302, 401, 403, 419]).toContain(post.status());
    const del = await page.request.delete(`${LIST}/1/delete`, { headers, maxRedirects: 0 });
    expect([302, 401, 403, 404, 419]).toContain(del.status());
    if (del.status() === 302) expect(del.headers()['location']).toMatch(/\/admin\/login$/);
    await page.context().close();
  });

  test('S3: CSRF token’siz POST/DELETE → 419, ma’lumot o‘zgarmaydi', async ({ page }) => {
    const id = await createViaApi(page, qaTitle('csrf'));
    const post = await page.request.post(LIST, { data: { title: 'AT-QA csrf attack', course_ids: [1] }, maxRedirects: 0 });
    expect(post.status()).toBe(419);
    const del = await page.request.delete(`${LIST}/${id}/delete`, { maxRedirects: 0 });
    expect(del.status()).toBe(419);
    await page.goto(LIST);
    await expect(row(page, id)).toBeVisible();
  });

  test('S4: XSS — sarlavhadagi HTML/JS bajarilmaydi, matn sifatida ko‘rsatiladi', async ({ page }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>AT-QA xss ${stamp()}`;
    const id = await createViaApi(page, payload);
    await page.goto(LIST);
    await expect(row(page, id).locator('a').first()).toHaveText(payload);
    await expect(page.locator('tbody img[src="x"], tbody script')).toHaveCount(0);
    await page.goto(`${LIST}/${id}/edit`);
    await expect(page.locator('#title')).toHaveValue(payload);
    await page.goto(`${LIST}/${id}`);
    await page.waitForLoadState('networkidle');
    expect(alerted, 'alert() must not fire').toBe(false);
  });

  test('S5: XSS — section sarlavhasi va savol matni bajarilmaydi', async ({ page }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    const id = await createViaApi(page, qaTitle('xss section'));
    await openNewSection(page, id);
    const payload = '<svg onload=alert(1)>XSS';
    await page.locator('#title').fill(payload);
    const prefix = await addMultipleChoice(page);
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

  test('S6: SQL injection — sarlavha literal saqlanadi, ro‘yxat buzilmaydi', async ({ page }) => {
    const payload = `AT-QA '; DROP TABLE placement_tests; -- " OR 1=1 ${stamp()}`;
    const id = await createViaApi(page, payload);
    const [, title] = await rowCells(page, id);
    expect(title).toBe(payload);
    await expect(page.locator('tbody tr').nth(1)).toBeVisible(); // other tests still listed
  });

  test('S7: noto‘g‘ri ID (SQLi / matn) → 404, stack trace / SQL xatosi oshkor bo‘lmaydi', async ({ page }) => {
    for (const bad of [MISSING_ID, "1'OR'1'='1", 'abc', '-1']) {
      const res = await page.goto(`${LIST}/${encodeURIComponent(bad)}/edit`);
      expect(res?.status(), bad).toBe(404);
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/SQLSTATE|Exception|Stack trace|vendor\/laravel/i);
    }
  });

  test('S8: public sahifa — SQLi/XSS lead id’dan tozalanadi', async ({ page }) => {
    let alerted = false;
    page.on('dialog', d => { alerted = true; d.dismiss(); });
    await page.goto(PUBLIC_START);
    const input = page.locator('#placement-test-lead-id');
    await input.fill("1' OR '1'='1");
    await expect(input).toHaveValue('111');
    await input.fill('<script>alert(1)</script>');
    // pasted markup is stripped (tag content included) — only digits, if any, may remain
    await expect(input).toHaveValue(/^\d*$/);
    expect(alerted).toBe(false);
  });

  test('S9: public start API — SQLi payload test ochib bermaydi', async ({ page }) => {
    await page.goto(PUBLIC_START);
    const cookie = (await page.context().cookies(PUBLIC_START)).find(c => c.name === 'XSRF-TOKEN');
    const res = await page.request.post(`${PUBLIC_START}/start`, {
      headers: cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.value), 'X-Requested-With': 'XMLHttpRequest' } : {},
      data: { lead_id: "1 OR 1=1" },
      maxRedirects: 0,
    });
    expect(res.status()).toBeLessThan(500);
    expect(res.headers()['location'] ?? '').not.toMatch(/attempt/);
  });

  test('S10: sessiya cookie HttpOnly+Secure, xavfsizlik headerlari', async ({ page }) => {
    const res = await page.goto(LIST);
    const headers = res!.headers();
    expect(headers['x-frame-options']).toMatch(/SAMEORIGIN|DENY/i);
    expect(headers['x-content-type-options']).toBe('nosniff');
    const session = (await page.context().cookies()).find(c => /session/i.test(c.name));
    expect(session, 'session cookie').toBeTruthy();
    expect(session!.httpOnly).toBe(true);
    expect(session!.secure).toBe(true);
  });
});
