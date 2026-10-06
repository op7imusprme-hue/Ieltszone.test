import fs from 'fs';
import path from 'path';
import { test, expect, Page } from '@playwright/test';
import {
  addDays,
  kanbanColumn,
  openLeadOnBoard,
  pickDate,
  pickDateViaNav,
  randomPhone,
  rowMenu,
  saveLead,
  selectInBox,
  selectOption,
  submit,
  takeLead,
  uiDate,
} from './helpers';
import { PLACEMENT_ANSWERS, PLACEMENT_LEVELS, PLACEMENT_TEST } from './placement-answers';

const CALL_CENTER_BOARD = '/admin/lead-funnels/1';
const ADMIN_BOARD = '/admin/lead-funnels/administration/leads';
const PLACEMENT_URL = 'https://demo.ieltszoneapp.uz/placement-test';
const PAYMENT = '990000';
const COUNTER_FILE = path.join(__dirname, '..', 'student-flow-counter.json');

/** Next sequence number for the lead name: 0001, 0002, ... (kept in student-flow-counter.json). */
function nextSequence(): string {
  let last = 0;
  try {
    last = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).last ?? 0;
  } catch {}
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ last: last + 1 }, null, 2) + '\n');
  return String(last + 1).padStart(4, '0');
}

/** Row of a group (by the ID in its first column) on the student profile. */
function groupRow(page: Page, groupId: string) {
  return page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*#?${groupId}\\s*$`) }) });
}

/**
 * Open a lead card on the Call center board and save it with another column.
 * Some columns require a date: "Qayta aloqa" → details.contact_later_on, "Uchrashuvga yozildi" → details.arrival_date.
 */
async function moveLeadToColumn(page: Page, name: string, leadId: string, column: string, dateField: string, date: Date) {
  await openLeadOnBoard(page, CALL_CENTER_BOARD, name, leadId);
  await expect(page.locator('#name')).toBeVisible();
  await selectOption(page, 'lead_column_id', column);
  await pickDate(page, dateField, date);
  await expect(page.locator(`[id="${dateField}"]`)).not.toHaveValue('');
  await saveLead(page, leadId);
}

test('Student Flow', async ({ page, context }) => {
  test.setTimeout(15 * 60_000);

  const lead = {
    name: process.env.LEAD_NAME ?? `Autotest ${nextSequence()}`,
    surname: 'Playwright',
    phone: process.env.LEAD_PHONE ?? randomPhone(),
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
  // number of passed placement sections → the level is the first section that is not passed
  const passedSections = Number(process.env.PASSED_SECTIONS ?? Math.floor(Math.random() * PLACEMENT_LEVELS.length));
  const expectedLevel = PLACEMENT_LEVELS[passedSections];
  const arrival = addDays(1);
  let leadId = '';
  let groupId = '';
  let studentId = '';
  let chatName = '';
  // Debug: resume an existing run, e.g. START_STEP=10 LEAD_ID=69430 LEAD_NAME="Autotest 0001" GROUP_ID=910 STUDENT_ID=22957
  const startStep = Number(process.env.START_STEP ?? 1);
  leadId = process.env.LEAD_ID ?? '';
  groupId = process.env.GROUP_ID ?? '';
  studentId = process.env.STUDENT_ID ?? '';
  if (process.env.LEAD_NAME) lead.name = process.env.LEAD_NAME;
  const step = (n: number, title: string, body: () => Promise<void>) =>
    n < startStep ? Promise.resolve() : test.step(title, body);
  test.info().annotations.push({ type: 'lead', description: lead.name }, { type: 'level', description: expectedLevel });

  await step(1, '1. Community → Kiruvchi lidlar: lidni olish', async () => {
    await page.goto('/admin/dashboard');
    await page.getByRole('link', { name: /^Community/ }).click();
    await expect(page).toHaveURL(/\/admin\/imbox/);
    await page.locator('.multiselect-wrapper').filter({ hasText: 'Select column' }).click();
    await page.locator('[role="option"]:visible').filter({ hasText: 'Kiruvchi lidlar' }).first().click();
    await expect(page).toHaveURL(/lead_column_id/);

    const firstChat = page.locator('a[href*="chat_id="]').first();
    await expect(firstChat).toBeVisible();
    leadId = new URL((await firstChat.getAttribute('href'))!).searchParams.get('chat_id')!;
    test.info().annotations.push({ type: 'lead id', description: leadId });
    // the list is live (a new message moves its chat to the top), so pin the chat by its id
    const chat = page.locator(`a[href*="chat_id=${leadId}&"], a[href$="chat_id=${leadId}"]`).first();
    await chat.click();
    await expect(page).toHaveURL(new RegExp(`chat_id=${leadId}`));

    // the lead card opens from the avatar in the chat header
    chatName = (await chat.locator('.font-medium.truncate').first().innerText()).trim();
    await page.getByRole('button', { name: chatName }).first().click();
    await takeLead(page, leadId);
  });

  await step(2, '2. Ma’lumotlarni kiritish → Call center "Yangi lidlar"', async () => {
    await page.reload();
    await page.getByRole('button', { name: chatName }).first().click();
    await expect(page.locator('#name')).toBeVisible();

    await selectOption(page, 'lead_funnel_id', 'Call markaz');
    await selectOption(page, 'lead_column_id', 'Yangi lidlar');
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

    await page.goto(`${CALL_CENTER_BOARD}?filter[search]=${encodeURIComponent(lead.name)}`);
    await expect(kanbanColumn(page, 'Yangi lidlar').getByText(`#${leadId}`, { exact: true })).toBeAttached();
  });

  await step(3, '3. Call center: Yangi lidlar → Qayta aloqa', async () => {
    await moveLeadToColumn(page, lead.name, leadId, 'Qayta aloqa', 'details.contact_later_on', addDays(1));
  });

  await step(4, '4. Call center: Qayta aloqa → Uchrashuvga yozildi (kelish sanasi tekshiriladi)', async () => {
    await moveLeadToColumn(page, lead.name, leadId, 'Uchrashuvga yozildi', 'details.arrival_date', arrival);
    await page.keyboard.press('Escape');
    await page.goto(`${CALL_CENTER_BOARD}?filter[search]=${encodeURIComponent(lead.name)}`);
    await page.waitForLoadState('networkidle');
    const card = kanbanColumn(page, 'Uchrashuvga yozildi')
      .getByText(`#${leadId}`, { exact: true })
      .locator('xpath=ancestor::div[.//*[contains(text(),"Kelish sanasi")]][1]');
    await expect(card).toContainText(`Kelish sanasi: ${uiDate(arrival)}`);
  });

  await step(5, '5. Administratsiya: Uchrashuvga yozildi → Filialga keldi', async () => {
    await openLeadOnBoard(page, ADMIN_BOARD, lead.name, leadId);
    await takeLead(page, leadId);
  });

  await step(6, '6. Sinov test yaratish', async () => {
    await openLeadOnBoard(page, ADMIN_BOARD, lead.name, leadId);
    await page.getByRole('button', { name: 'Sinov test yaratish' }).click();
    await selectInBox(page, 'assessment_id', PLACEMENT_TEST);
    await page.getByRole('button', { name: 'Sinov test yaratish' }).last().click();
    await expect(page.getByText('Lid uchun quiz generatsiya qilindi').first()).toBeVisible();
  });

  await step(7, `7. Placement test (lead id ${leadId}) → ${expectedLevel}`, async () => {
    const pt = await context.newPage();
    await pt.goto(PLACEMENT_URL);
    await pt.locator('#placement-test-lead-id').fill(leadId);
    await pt.locator('button[type=submit]').click();
    await expect(pt).toHaveURL(/placement-test\/attempt/);

    // an unfinished attempt is resumed by the site at its current section ("SECTION 5 / 6")
    const sectionLabel = pt.getByText(/section \d+ \//i).first();
    await expect(sectionLabel).toBeVisible();
    const firstSection = Number((await sectionLabel.innerText()).match(/\d+/)![0]) - 1;

    for (let section = firstSection; section < PLACEMENT_LEVELS.length; section++) {
      await expect(pt.getByText(new RegExp(`section ${section + 1} /`, 'i'))).toBeVisible();
      const questions = pt.locator('div.rounded-2xl:has(> div > h4):has(form)');
      await expect(questions.first()).toBeVisible();
      const count = await questions.count();
      for (let q = 0; q < count; q++) {
        const question = questions.nth(q);
        const prompt = (await question.locator('> p').innerText()).trim();
        const correct = PLACEMENT_ANSWERS[prompt];
        expect(correct, `no answer for: ${prompt}`).toBeDefined();
        const options = question.locator('form > div');
        // the option text may carry a "correct" mark added in the admin: ">> …", "…   ✅", "…   c", "…  c✅"
        const texts = (await options.allInnerTexts()).map(t =>
          t.replace(/^\s*>>/, '').replace(/(\s+c)?\s*✅?\s*$/, '').trim(),
        );
        const correctIndex = texts.indexOf(correct);
        expect(correctIndex, `no option "${correct}" in ${JSON.stringify(texts)}`).toBeGreaterThanOrEqual(0);
        // passed section: exactly 4 correct (the minimum), failed section: all wrong
        const answerCorrectly = section < passedSections && q < 4;
        await options.nth(answerCorrectly ? correctIndex : (correctIndex + 1) % texts.length).click();
      }
      await pt.getByRole('button', { name: section === PLACEMENT_LEVELS.length - 1 ? 'Finish' : 'Next' }).click();
    }

    // result card: "Your level" followed by the level name
    await expect(pt.locator('p', { hasText: /^Your level$/ }).locator('xpath=following-sibling::*[1]')).toHaveText(expectedLevel);
    await pt.close();
  });

  await step(8, '8. Lid chatida natija ko‘rinadi', async () => {
    await openLeadOnBoard(page, ADMIN_BOARD, lead.name, leadId);
    await expect(page.getByText('Lid quizni yechdi').first()).toBeVisible();
    await expect(page.getByText(`Quiz Result: ${expectedLevel}`).first()).toBeVisible();
  });

  await step(9, '9. Mos guruhga qo‘shish (topilmasa level o‘zgartiriladi)', async () => {
    await page.goto(`/admin/leads/${leadId}/choose-a-suitable-group/active`);
    await page.waitForLoadState('networkidle');
    const addButtons = page.locator('table tbody tr td:last-child button');
    const levelSelect = page.locator('.multiselect-wrapper:visible').last();

    if ((await addButtons.count()) === 0) {
      await levelSelect.click();
      const levels = await page.locator('[role="option"]:visible').allInnerTexts();
      await page.keyboard.press('Escape');
      for (const level of levels) {
        await levelSelect.click();
        await page.locator('[role="option"]:visible').filter({ hasText: level }).first().click();
        await page.waitForLoadState('networkidle');
        if ((await addButtons.count()) > 0) {
          test.info().annotations.push({ type: 'group level', description: level });
          break;
        }
      }
    }
    await expect(addButtons.first(), 'no suitable group for any level').toBeVisible();

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

  const studentRow = () => page.getByText(lead.name).first().locator('xpath=ancestor::tr[1]');
  const searchWaitingList = async () => {
    const searched = page.waitForResponse(r => decodeURIComponent(r.url()).includes('filter[search]='));
    // multi-word search ("Autotest 0001") finds nothing here, the phone is unique
    await page.locator('#search').fill(lead.phone);
    await page.locator('#search').press('Enter');
    await searched;
    await expect(studentRow()).toBeVisible();
  };

  await step(10, '10. Guruhda: "Sinov darsga kelganlar"', async () => {
    await page.goto(`/admin/groups/${groupId}`);
    await expect(studentRow()).toBeVisible();
    studentId = (await studentRow().locator('a[href*="/admin/students/"]').first().getAttribute('href'))!.split('/').pop()!;
    test.info().annotations.push({ type: 'student id', description: studentId });

    await rowMenu(page, studentRow(), 'Sinov darsga kelganlar');
    await submit(page, /^\/admin\//, () => page.getByRole('button', { name: 'Tasdiqlang' }).click());
    await page.goto(`/admin/students/${studentId}`);
    await expect(groupRow(page, groupId)).toContainText('Sinov darsida qatnashdi');
  });

  await step(11, `11. Moliya → Kassalar → Daromad: "Student to'ladi" ${PAYMENT} UZS`, async () => {
    await page.goto('/admin/dashboard');
    await page.getByText('Moliya', { exact: true }).click();
    await page.getByRole('link', { name: 'Kassalar' }).click();
    await expect(page).toHaveURL(/\/admin\/cashboxes$/);
    const cashbox = page.locator('a[href*="/admin/cashboxes/"]').filter({ hasText: 'UZS' }).first();
    const cashboxUrl = (await cashbox.getAttribute('href'))!;
    await cashbox.click();
    await expect(page).toHaveURL(cashboxUrl);

    await page.locator('button').filter({ has: page.locator('span', { hasText: /^Daromad$/ }) }).first().click();
    await expect(page.getByText('Yangi daromad')).toBeVisible();
    await selectInBox(page, 'transaction_type_id', "Student to'ladi");
    const student = page.locator('.multiselect-wrapper').filter({ hasText: 'Talaba telefonini tering' });
    await student.click();
    await student.locator('input').pressSequentially(lead.phone, { delay: 50 });
    await page.locator('[role="option"]:visible').filter({ hasText: lead.name }).first().click();
    await selectInBox(page, 'group_id', `#${groupId}`);
    await selectInBox(page, 'payment_method', 'Naqd');
    await page.locator('#debit').fill(PAYMENT);
    await page.locator('#description').fill(`Playwright autotest ${lead.name}`);
    await page.getByRole('button', { name: 'Saqlash' }).last().click();
    // a receipt pops up instead of a toast
    const receipt = page.locator('div').filter({ hasText: 'Cheque:' }).filter({ hasText: 'AIM FOR THE HIGHEST' }).last();
    await expect(receipt).toContainText(lead.name);
    await expect(receipt).toContainText('990 000 UZS');
    await page.keyboard.press('Escape');
  });

  await step(12, '12. Talaba aktivlashdi', async () => {
    await page.goto(`/admin/students/${studentId}`);
    await expect(page.getByText(/990 000(\.00)? UZS/).first()).toBeVisible();
    await expect(groupRow(page, groupId)).toContainText('Faol');
  });

  await step(13, '13. Kutish ro‘yxatiga o‘tkazish va tekshirish', async () => {
    await page.goto(`/admin/groups/${groupId}`);
    await rowMenu(page, studentRow(), 'Kutish ro`yxatiga o`tkazish');
    await selectInBox(page, 'waiting_reason', /./);
    await page.locator('#waiting_comment').fill('Playwright autotest');
    await submit(page, /\/transfer-to-waiting/, () => page.getByRole('button', { name: 'Tasdiqlang' }).click());

    // Administratsiya → Kutish ro'yxati
    await page.goto('/admin/dashboard');
    await page.getByText('Administratsiya', { exact: true }).first().click();
    await page.locator('a[href$="/admin/waiting"]', { hasText: 'Kutish roʻyxati' }).click();
    await expect(page).toHaveURL(/\/admin\/waiting/);
    await searchWaitingList();
  });

  await step(14, '14. Kutish ro‘yxatidan → To‘plam guruhga', async () => {
    if (startStep === 14) {
      await page.goto('/admin/waiting');
      await searchWaitingList();
    }
    await rowMenu(page, studentRow(), "Tanlovga qo'shish");
    await expect(page).toHaveURL(/\/admin\/waiting\/\d+\/selection/, { timeout: 60_000 });
    const addButtons = page.locator('table tbody tr td:last-child button');
    await expect(addButtons.first()).toBeVisible();
    groupId = (await addButtons.first().locator('xpath=ancestor::tr/td[1]').innerText()).replace('#', '').trim();
    test.info().annotations.push({ type: 'to‘plam group', description: groupId });
    await addButtons.first().click();
    await submit(page, /^\/admin\/waiting\/\d+\/\d+$/, () => page.getByRole('button', { name: "Ko'chirish" }).click());

    await page.goto(`/admin/groups/${groupId}`);
    await expect(page.getByText('Selection').first()).toBeVisible(); // group status
    await expect(studentRow()).toBeVisible();
  });

  await step(15, '15. To‘plam guruhdan → Aktiv guruhga', async () => {
    await rowMenu(page, studentRow(), 'Aktiv guruhga kochirish');
    await expect(page).toHaveURL(/choose-a-suitable-group\/active/, { timeout: 60_000 });
    const addButtons = page.locator('table tbody tr td:last-child button');
    await expect(addButtons.first()).toBeVisible();
    const activeGroupId = (await addButtons.first().locator('xpath=ancestor::tr/td[1]').innerText()).replace('#', '').trim();
    test.info().annotations.push({ type: 'active group', description: activeGroupId });
    await addButtons.first().click();
    await selectInBox(page, 'transfer_reason', /./);
    await pickDate(page, 'planned_first_lesson_date', addDays(1));
    await page.locator('#comment').fill('Playwright autotest');
    await submit(page, /\/transfer-to-group/, () => page.getByRole('button', { name: "Ko'chirish" }).click());

    // the transfer is applied a moment after the response, so reload the profile until it shows up
    await expect(async () => {
      await page.goto(`/admin/students/${studentId}`);
      await expect(groupRow(page, activeGroupId)).toBeVisible({ timeout: 5_000 });
      await expect(groupRow(page, activeGroupId)).not.toContainText('Arxivlandi', { timeout: 1_000 });
      await expect(groupRow(page, groupId)).toContainText('Arxivlandi', { timeout: 1_000 });
    }).toPass({ timeout: 60_000 });
  });
});
