const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  await p.goto('/admin/placement-test'); await p.waitForLoadState('networkidle');
  console.log('URL', p.url());
  console.log((await p.locator('main').innerText()).slice(0, 2500));
  const html = await p.locator('main').innerHTML();
  console.log('---TABLE HEAD', await p.locator('thead').innerText().catch(()=>'none'));
  console.log('---ROW0 HTML', (await p.locator('tbody tr').first().innerHTML()).slice(0,3000));
  await p.screenshot({ path: 'explore/list.png' });
  await p.goto('/admin/placement-test/create'); await p.waitForLoadState('networkidle');
  console.log('---CREATE', await p.locator('main').innerText());
  console.log('---FORM HTML', (await p.locator('form').first().innerHTML()).slice(0,8000));
  await p.screenshot({ path: 'explore/create.png', fullPage:true });
  await b.close();
})();
