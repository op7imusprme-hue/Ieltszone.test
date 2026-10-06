import { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { selectInBox, visibleOptions } from '@components/multiselect';
import { pickDate } from '@components/datepicker';
import { addToGroupButtons, groupIdOfRow, rowMenu } from '@components/table';
import { AUTOTEST_COMMENT, buildLead } from '@data/lead';
import { routes } from '@data/routes';
import { DEMO_TEST_ANSWERS, DEMO_TEST_LEVELS, DEMO_TEST_TITLE } from '@data/placement/demo-test';
import { optionsOf, shouldAnswerCorrectly } from '@pages/public/PlacementTestPage';
import { addDays, uiDate } from '@utils/dates';
import { submit } from '@utils/network';
import { randomInt } from '@utils/random';
import { state } from '@utils/state';

const PAYMENT = '990000';

/** Row of a group (by the ID in its first column) on the student profile. */
function groupRow(page: Page, groupId: string) {
  return page.locator('tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*#?${groupId}\\s*$`) }) });
}

/**
 * Community'dagi yangi liddan to aktiv guruhdagi talabagacha bo'lgan to'liq yo'l.
 * Debug: yarim qolgan talabani qadamdan davom ettirish —
 * START_STEP=10 LEAD_ID=69430 LEAD_NAME="Autotest 0001" LEAD_PHONE=000646826 GROUP_ID=910 STUDENT_ID=22957
 */
test('Student Flow', async ({ page, boards, leadCard, suitableGroups, publicPlacement }) => {
  test.setTimeout(15 * 60_000);

  // lead name: Autotest 0001, Autotest 0002, ... (the counter is kept in .state/)
  const lead = buildLead({
    name: process.env.LEAD_NAME ?? `Autotest ${String(state.next('student-flow-counter')).padStart(4, '0')}`,
    ...(process.env.LEAD_PHONE && { phone: process.env.LEAD_PHONE }),
  });
  // number of passed placement sections → the level is the first section that is not passed
  const passedSections = Number(process.env.PASSED_SECTIONS ?? randomInt(DEMO_TEST_LEVELS.length));
  const expectedLevel = DEMO_TEST_LEVELS[passedSections];
  const arrival = addDays(1);
  const startStep = Number(process.env.START_STEP ?? 1);
  let leadId = process.env.LEAD_ID ?? '';
  let groupId = process.env.GROUP_ID ?? '';
  let studentId = process.env.STUDENT_ID ?? '';
  let chatName = '';

  const step = (n: number, title: string, body: () => Promise<void>) =>
    n < startStep ? Promise.resolve() : test.step(title, body);
  test.info().annotations.push({ type: 'lead', description: lead.name }, { type: 'level', description: expectedLevel });

  /** Open the lead on the Call center board and save it with another column (+ the date that column requires). */
  const moveLeadToColumn = async (column: string, dateField: string, date: Date) => {
    await boards.callCenter.openLead(lead.name, leadId);
    await expect(leadCard.nameInput).toBeVisible();
    await leadCard.setColumn(column);
    await leadCard.setDate(dateField, date);
    await leadCard.save(leadId);
  };

  const studentRow = () => page.getByText(lead.name).first().locator('xpath=ancestor::tr[1]');
  const searchWaitingList = async () => {
    const searched = page.waitForResponse(r => decodeURIComponent(r.url()).includes('filter[search]='));
    // multi-word search ("Autotest 0001") finds nothing here, the phone is unique
    await page.locator('#search').fill(lead.phone);
    await page.locator('#search').press('Enter');
    await searched;
    await expect(studentRow()).toBeVisible();
  };

  await step(1, '1. Community → Kiruvchi lidlar: lidni olish', async () => {
    await page.goto(routes.dashboard);
    await page.getByRole('link', { name: /^Community/ }).click();
    await expect(page).toHaveURL(/\/admin\/imbox/);
    await page.locator('.multiselect-wrapper').filter({ hasText: 'Select column' }).click();
    await visibleOptions(page).filter({ hasText: 'Kiruvchi lidlar' }).first().click();
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
    await leadCard.take(leadId);
  });

  await step(2, '2. Ma’lumotlarni kiritish → Call center "Yangi lidlar"', async () => {
    await page.reload();
    await page.getByRole('button', { name: chatName }).first().click();
    await expect(leadCard.nameInput).toBeVisible();
    await leadCard.setFunnel('Call markaz', 'Yangi lidlar');
    await leadCard.fillDetails(lead);
    await leadCard.save(leadId);

    await page.goto(`${routes.boards.callCenter}?filter[search]=${encodeURIComponent(lead.name)}`);
    await expect(boards.callCenter.card('Yangi lidlar', leadId)).toBeAttached();
  });

  await step(3, '3. Call center: Yangi lidlar → Qayta aloqa', async () => {
    await moveLeadToColumn('Qayta aloqa', 'details.contact_later_on', addDays(1));
  });

  await step(4, '4. Call center: Qayta aloqa → Uchrashuvga yozildi (kelish sanasi tekshiriladi)', async () => {
    await moveLeadToColumn('Uchrashuvga yozildi', 'details.arrival_date', arrival);
    await page.keyboard.press('Escape');
    await boards.callCenter.open(lead.name);
    const card = boards.callCenter
      .card('Uchrashuvga yozildi', leadId)
      .locator('xpath=ancestor::div[.//*[contains(text(),"Kelish sanasi")]][1]');
    await expect(card).toContainText(`Kelish sanasi: ${uiDate(arrival)}`);
  });

  await step(5, '5. Administratsiya: Uchrashuvga yozildi → Filialga keldi', async () => {
    await boards.administration.openLead(lead.name, leadId);
    await leadCard.take(leadId);
  });

  await step(6, '6. Sinov test yaratish', async () => {
    await boards.administration.openLead(lead.name, leadId);
    await leadCard.createQuiz(DEMO_TEST_TITLE);
  });

  await step(7, `7. Placement test (lead id ${leadId}) → ${expectedLevel}`, async () => {
    await publicPlacement.start(leadId);
    await publicPlacement.solve(DEMO_TEST_LEVELS.length, async (question, section, index) => {
      const prompt = (await question.locator('> p').innerText()).trim();
      const correct = DEMO_TEST_ANSWERS[prompt];
      expect(correct, `no answer for: ${prompt}`).toBeDefined();
      const options = optionsOf(question);
      // the option text may carry a "correct" mark added in the admin: ">> …", "…   ✅", "…   c", "…  c✅"
      const texts = (await options.allInnerTexts()).map(t => t.replace(/^\s*>>/, '').replace(/(\s+c)?\s*✅?\s*$/, '').trim());
      const correctIndex = texts.indexOf(correct);
      expect(correctIndex, `no option "${correct}" in ${JSON.stringify(texts)}`).toBeGreaterThanOrEqual(0);
      const answerCorrectly = shouldAnswerCorrectly(section, index, passedSections);
      await options.nth(answerCorrectly ? correctIndex : (correctIndex + 1) % texts.length).click();
    });
    await publicPlacement.expectLevel(expectedLevel);
  });

  await step(8, '8. Lid chatida natija ko‘rinadi', async () => {
    await boards.administration.openLead(lead.name, leadId);
    await expect(page.getByText('Lid quizni yechdi').first()).toBeVisible();
    await expect(page.getByText(`Quiz Result: ${expectedLevel}`).first()).toBeVisible();
  });

  await step(9, '9. Mos guruhga qo‘shish (topilmasa level o‘zgartiriladi)', async () => {
    await suitableGroups.open(leadId);
    await suitableGroups.ensureSomeGroup();
    groupId = await suitableGroups.addToFirstGroup(leadId);
    test.info().annotations.push({ type: 'group', description: groupId });
  });

  await step(10, '10. Guruhda: "Sinov darsga kelganlar"', async () => {
    await page.goto(routes.group(groupId));
    await expect(studentRow()).toBeVisible();
    studentId = (await studentRow().locator('a[href*="/admin/students/"]').first().getAttribute('href'))!.split('/').pop()!;
    test.info().annotations.push({ type: 'student id', description: studentId });

    await rowMenu(page, studentRow(), 'Sinov darsga kelganlar');
    await submit(page, /^\/admin\//, () => page.getByRole('button', { name: 'Tasdiqlang' }).click());
    await page.goto(routes.student(studentId));
    await expect(groupRow(page, groupId)).toContainText('Sinov darsida qatnashdi');
  });

  await step(11, `11. Moliya → Kassalar → Daromad: "Student to'ladi" ${PAYMENT} UZS`, async () => {
    await page.goto(routes.dashboard);
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
    await visibleOptions(page).filter({ hasText: lead.name }).first().click();
    await selectInBox(page, 'group_id', `#${groupId}`);
    await selectInBox(page, 'payment_method', 'Naqd');
    await page.locator('#debit').fill(PAYMENT);
    await page.locator('#description').fill(`${AUTOTEST_COMMENT} ${lead.name}`);
    await page.getByRole('button', { name: 'Saqlash' }).last().click();
    // a receipt pops up instead of a toast
    const receipt = page.locator('div').filter({ hasText: 'Cheque:' }).filter({ hasText: 'AIM FOR THE HIGHEST' }).last();
    await expect(receipt).toContainText(lead.name);
    await expect(receipt).toContainText('990 000 UZS');
    await page.keyboard.press('Escape');
  });

  await step(12, '12. Talaba aktivlashdi', async () => {
    await page.goto(routes.student(studentId));
    await expect(page.getByText(/990 000(\.00)? UZS/).first()).toBeVisible();
    await expect(groupRow(page, groupId)).toContainText('Faol');
  });

  await step(13, '13. Kutish ro‘yxatiga o‘tkazish va tekshirish', async () => {
    await page.goto(routes.group(groupId));
    await rowMenu(page, studentRow(), 'Kutish ro`yxatiga o`tkazish');
    await selectInBox(page, 'waiting_reason', /./);
    await page.locator('#waiting_comment').fill(AUTOTEST_COMMENT);
    await submit(page, /\/transfer-to-waiting/, () => page.getByRole('button', { name: 'Tasdiqlang' }).click());

    // Administratsiya → Kutish ro'yxati
    await page.goto(routes.dashboard);
    await page.getByText('Administratsiya', { exact: true }).first().click();
    await page.locator('a[href$="/admin/waiting"]', { hasText: 'Kutish roʻyxati' }).click();
    await expect(page).toHaveURL(/\/admin\/waiting/);
    await searchWaitingList();
  });

  await step(14, '14. Kutish ro‘yxatidan → To‘plam guruhga', async () => {
    if (startStep === 14) {
      await page.goto(routes.waitingList);
      await searchWaitingList();
    }
    await rowMenu(page, studentRow(), "Tanlovga qo'shish");
    await expect(page).toHaveURL(/\/admin\/waiting\/\d+\/selection/, { timeout: 60_000 });
    const addButtons = addToGroupButtons(page);
    await expect(addButtons.first()).toBeVisible();
    groupId = await groupIdOfRow(addButtons.first());
    test.info().annotations.push({ type: 'to‘plam group', description: groupId });
    await addButtons.first().click();
    await submit(page, /^\/admin\/waiting\/\d+\/\d+$/, () => page.getByRole('button', { name: "Ko'chirish" }).click());

    await page.goto(routes.group(groupId));
    await expect(page.getByText('Selection').first()).toBeVisible(); // group status
    await expect(studentRow()).toBeVisible();
  });

  await step(15, '15. To‘plam guruhdan → Aktiv guruhga', async () => {
    await rowMenu(page, studentRow(), 'Aktiv guruhga kochirish');
    await expect(page).toHaveURL(/choose-a-suitable-group\/active/, { timeout: 60_000 });
    const addButtons = addToGroupButtons(page);
    await expect(addButtons.first()).toBeVisible();
    const activeGroupId = await groupIdOfRow(addButtons.first());
    test.info().annotations.push({ type: 'active group', description: activeGroupId });
    await addButtons.first().click();
    await selectInBox(page, 'transfer_reason', /./);
    await pickDate(page, 'planned_first_lesson_date', addDays(1));
    await page.locator('#comment').fill(AUTOTEST_COMMENT);
    await submit(page, /\/transfer-to-group/, () => page.getByRole('button', { name: "Ko'chirish" }).click());

    // the transfer is applied a moment after the response, so reload the profile until it shows up
    await expect(async () => {
      await page.goto(routes.student(studentId));
      await expect(groupRow(page, activeGroupId)).toBeVisible({ timeout: 5_000 });
      await expect(groupRow(page, activeGroupId)).not.toContainText('Arxivlandi', { timeout: 1_000 });
      await expect(groupRow(page, groupId)).toContainText('Arxivlandi', { timeout: 1_000 });
    }).toPass({ timeout: 60_000 });
  });
});
