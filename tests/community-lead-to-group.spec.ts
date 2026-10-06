import { test, expect } from '@playwright/test';
import {
  addDays,
  kanbanColumn,
  openLeadOnBoard,
  pickDate,
  pickDateViaNav,
  randomPhone,
  saveLead,
  selectOption,
  submit,
  takeLead,
} from './helpers';

const COMMUNITY_BOARD = '/admin/lead-funnels/2';
const ADMIN_BOARD = '/admin/lead-funnels/administration/leads';

test('Community: yangi lidni olib, mos guruhga qo‘shish', async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  const lead = {
    name: `Autotest${stamp}`,
    surname: 'Playwright',
    phone: randomPhone(),
    branch: 'Integro filial 11',
    course: 'General English',
    subCourse: 'Elementary',
    who: 'Talaba',
    locale: 'UZ',
    gender: 'Erkak',
    age: '20',
    days: 'Toq kunlar',
    time: '14:00 - 16:00',
  };
  // Debug: resume on an existing lead, e.g. LEAD_ID=68899 LEAD_NAME=Autotest763520 START_STEP=3
  const startStep = Number(process.env.START_STEP ?? (process.env.LEAD_ID ? 2 : 1));
  let leadId = process.env.LEAD_ID ?? '';
  let originalName = process.env.LEAD_NAME ?? '';
  let groupId = '';

  await test.step('1. Community → Kiruvchi lidlar: birinchi lidni olish', async () => {
    if (startStep > 1) return;
    await page.goto(COMMUNITY_BOARD);
    await page.waitForLoadState('networkidle');
    const incoming = kanbanColumn(page, 'Kiruvchi lidlar');
    const ids = incoming.getByText(/^\s*#\d+\s*$/);
    await expect(ids.first()).toBeVisible();

    // The board search only matches a name prefix and ignores names like "_abc",
    // so take the first lead whose name starts with a letter or digit.
    let firstId = ids.first();
    for (let i = 0; i < (await ids.count()); i++) {
      const card = ids.nth(i).locator('xpath=ancestor::div[.//*[contains(text(),"Source")]][1]');
      // card text: "#id", "date time", "<name>", "Source:", ...
      const name = (await card.innerText()).split('\n').map(s => s.trim()).filter(Boolean)[2];
      if (/^[\p{L}\d]/u.test(name)) {
        firstId = ids.nth(i);
        originalName = name;
        break;
      }
    }
    expect(originalName, 'no incoming lead with a searchable name').not.toBe('');
    leadId = (await firstId.innerText()).replace('#', '').trim();
    test.info().annotations.push({ type: 'lead', description: `#${leadId} ${originalName}` });

    await firstId.click();
    await takeLead(page, leadId);
    await expect(incoming.getByText(`#${leadId}`, { exact: true })).toHaveCount(0);
  });

  await test.step('2. Lidni Call markaz → "Uchrashuvga yozildi" ga o‘tkazish', async () => {
    if (startStep > 2) { lead.name = originalName; return; }
    await openLeadOnBoard(page, COMMUNITY_BOARD, originalName, leadId);
    await expect(page.locator('#name')).toBeVisible();

    await selectOption(page, 'lead_funnel_id', 'Call markaz');
    await selectOption(page, 'lead_column_id', 'Uchrashuvga yozildi');
    await pickDate(page, 'details.arrival_date', addDays(1));
    await expect(page.locator('[id="details.arrival_date"]')).not.toHaveValue('');

    await page.locator('#name').fill(lead.name);
    await page.locator('#surname').fill(lead.surname);
    await page.locator('#phone').fill(lead.phone);
    await selectOption(page, 'details.who', lead.who);
    await selectOption(page, 'details.locale', lead.locale);
    await selectOption(page, 'details.gender', lead.gender);
    await page.locator('[id="details.age"]').fill(lead.age);
    await selectOption(page, 'details.suitable_days', lead.days);
    await selectOption(page, 'details.suitable_times', lead.time);
    await page.getByText(/KURS HAQIDA/i).first().click(); // close the multi-select
    await selectOption(page, 'details.branch', lead.branch);
    await selectOption(page, 'details.course', lead.course);
    await selectOption(page, 'details.subCourse', lead.subCourse);

    await saveLead(page, leadId);
  });

  await test.step('3. Administratsiya: lidni olish (Filialga keldi)', async () => {
    if (startStep > 3) return;
    await openLeadOnBoard(page, ADMIN_BOARD, lead.name, leadId);
    await takeLead(page, leadId);
  });

  await test.step('4. "Mos guruhga qo‘shing" → istalgan guruhni tanlash', async () => {
    await openLeadOnBoard(page, ADMIN_BOARD, lead.name, leadId);
    const link = page.getByRole('link', { name: "Mos guruhga qo'shing" });
    await expect(link).toBeAttached();
    await page.goto((await link.getAttribute('href'))!);
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${leadId}/choose-a-suitable-group`));

    // any group: the first "+" button in the groups tables
    const addButtons = page.locator('table tbody tr td:last-child button');
    await expect(addButtons.first()).toBeVisible();
    groupId = (await addButtons.first().locator('xpath=ancestor::tr/td[1]').innerText()).replace('#', '').trim();
    test.info().annotations.push({ type: 'group', description: groupId });
    await addButtons.first().click();

    await expect(page.getByText('Lidni mos guruhga qo`shish')).toBeVisible();
    await pickDate(page, 'planned_first_lesson_date', addDays(1));
    await pickDateViaNav(page, 'date_of_birth', new Date(2006, 0, 15));
    await expect(page.locator('#date_of_birth')).not.toHaveValue('');
    await page.locator('#comment').fill('Playwright autotest');
    await submit(page, `/admin/leads/${leadId}/add-to-suitable-group/${groupId}`, () =>
      page.getByRole('button', { name: "Qo'shish", exact: true }).click(),
    );
  });

  await test.step('5. Tekshirish: talaba guruhda', async () => {
    await page.goto(`/admin/groups/${groupId}`);
    await expect(page.getByText(`${lead.name}`).first()).toBeVisible();
  });
});
