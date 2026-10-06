const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.request().method()!=='GET') console.log('RESP', r.request().method(), new URL(r.url()).pathname, r.status()); });
  await p.goto('/admin/placement-test/256'); await p.waitForLoadState('networkidle');
  console.log('---SHOW', await p.locator('main').innerText());
  await p.screenshot({path:'explore/show.png', fullPage:true});
  await p.goto('/admin/placement-test/256/edit'); await p.waitForLoadState('networkidle');
  console.log('---EDIT', p.url(), await p.locator('main').innerText());
  console.log('edit vals', await p.locator('#title').inputValue(), await p.locator('#placement_time_limit_minutes').inputValue().catch(()=>'?'));
  // delete from list
  await p.goto('/admin/placement-test'); await p.waitForLoadState('networkidle');
  const row = p.locator('tr').filter({ has: p.locator('a[href$="/admin/placement-test/256"]') });
  await row.locator('button:has(svg.ri-delete-bin-6-line)').click();
  await p.waitForTimeout(800);
  console.log('---DIALOG', await p.locator('[role="dialog"]').innerText().catch(()=>'no dialog'));
  console.log((await p.locator('[role="dialog"]').innerHTML().catch(()=>'')).slice(0,1500));
  await b.close();
})();
