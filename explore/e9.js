const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pt = await (await b.newContext()).newPage();
  pt.on('response', async r => { if (r.request().method()!=='GET' && !r.url().includes('cdn-cgi')) console.log('  PRESP', new URL(r.url()).pathname, r.status(), r.request().postData()); });
  const tryId = async (v) => { await pt.goto('https://demo.ieltszoneapp.uz/placement-test'); await pt.locator('#placement-test-lead-id').fill(v); const val = await pt.locator('#placement-test-lead-id').inputValue(); const dis = await pt.locator('button[type=submit]').isDisabled(); if (!dis) { await pt.locator('button[type=submit]').click(); await pt.waitForTimeout(2500); } console.log('ID', JSON.stringify(v), 'val', JSON.stringify(val), 'disabled', dis, '->', pt.url(), '|', (await pt.locator('body').innerText()).replace(/\s+/g,' ').slice(0,250)); };
  for (const v of ['   ', '99999999', 'abc', "1' OR '1'='1", '-1', '0', '<script>alert(1)</script>', '1234567890123456', '69439']) await tryId(v);
  await b.close();
})();
