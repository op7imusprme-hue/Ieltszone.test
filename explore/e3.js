const { chromium } = require('playwright');
async function sel(p, opt){ await p.locator('[data-field="course_ids"] .multiselect-wrapper').click(); await p.locator('[role="option"]:visible').filter({hasText:new RegExp('^'+opt+'$')}).first().click(); await p.keyboard.press('Escape'); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.request().method()!=='GET') { console.log('RESP', r.request().method(), new URL(r.url()).pathname, r.status(), r.request().postData()?.slice(0,300)); const red = await r.request().redirectedTo()?.response(); if (red) {const j = await red.json().catch(()=>null); console.log('  -> ', red.url(), JSON.stringify(j?.props?.errors), j?.props?.flash ? JSON.stringify(j.props.flash):'');} } });
  const cases = [
    ['title 300', 'x'.repeat(300), '5', '0'],
    ['neg minutes', 'AT neg', '-5', '0'],
    ['sec 75', 'AT sec75', '1', '75'],
    ['zero time', 'AT zero', '0', '0'],
    ['empty time', 'AT emptytime', '', ''],
    ['spaces title', '    ', '5','0'],
  ];
  for (const [name, t, m, s] of cases) {
    console.log('=== ', name);
    await p.goto('/admin/placement-test/create'); await p.waitForLoadState('networkidle');
    await p.locator('#title').fill(t); await sel(p,'General English');
    await p.locator('#placement_time_limit_minutes').fill(m); await p.locator('#placement_time_limit_seconds').fill(s);
    console.log('vals', await p.locator('#placement_time_limit_minutes').inputValue(), await p.locator('#placement_time_limit_seconds').inputValue());
    await p.getByRole('button', { name: 'Save and add sections' }).click();
    await p.waitForTimeout(3000);
    console.log('URL', p.url());
    console.log('errs', await p.locator('p[id$="-error"], .text-red-600').allInnerTexts());
  }
  await b.close();
})();
