import { test, expect } from '@fixtures';
import { buildLead } from '@data/lead';
import { routes } from '@data/routes';
import { addDays } from '@utils/dates';

/**
 * Community'dan yangi kelgan lidni olib, guruhga qo'shish.
 * Debug: mavjud lid bilan qadamdan davom ettirish — LEAD_ID=68899 LEAD_NAME=Autotest763520 START_STEP=3
 */
test('Community: yangi lidni olib, mos guruhga qo‘shish', async ({ page, boards, leadCard, suitableGroups }) => {
  const lead = buildLead();
  const startStep = Number(process.env.START_STEP ?? (process.env.LEAD_ID ? 2 : 1));
  let leadId = process.env.LEAD_ID ?? '';
  let originalName = process.env.LEAD_NAME ?? '';
  let groupId = '';

  await test.step('1. Community → Kiruvchi lidlar: birinchi lidni olish', async () => {
    if (startStep > 1) return;
    await boards.community.open();
    const incoming = boards.community.column('Kiruvchi lidlar');
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
    await leadCard.take(leadId);
    await expect(incoming.getByText(`#${leadId}`, { exact: true })).toHaveCount(0);
  });

  await test.step('2. Lidni Call markaz → "Uchrashuvga yozildi" ga o‘tkazish', async () => {
    if (startStep > 2) {
      lead.name = originalName;
      return;
    }
    await boards.community.openLead(originalName, leadId);
    await expect(leadCard.nameInput).toBeVisible();
    await leadCard.setFunnel('Call markaz', 'Uchrashuvga yozildi');
    await leadCard.setDate('details.arrival_date', addDays(1));
    await leadCard.fillDetails(lead);
    await leadCard.save(leadId);
  });

  await test.step('3. Administratsiya: lidni olish (Filialga keldi)', async () => {
    if (startStep > 3) return;
    await boards.administration.openLead(lead.name, leadId);
    await leadCard.take(leadId);
  });

  await test.step('4. "Mos guruhga qo‘shing" → istalgan guruhni tanlash', async () => {
    await boards.administration.openLead(lead.name, leadId);
    const link = page.getByRole('link', { name: "Mos guruhga qo'shing" });
    await expect(link).toBeAttached();
    await page.goto((await link.getAttribute('href'))!);
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${leadId}/choose-a-suitable-group`));

    groupId = await suitableGroups.addToFirstGroup(leadId);
    test.info().annotations.push({ type: 'group', description: groupId });
  });

  await test.step('5. Tekshirish: talaba guruhda', async () => {
    await page.goto(routes.group(groupId));
    await expect(page.getByText(lead.name).first()).toBeVisible();
  });
});
