const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.request().method()!=='GET') { console.log('RESP', r.request().method(), r.url(), r.status()); console.log('  REQ', r.request().postData()?.slice(0,500)); } });
  await p.goto('/admin/placement-test/create'); await p.waitForLoadState('networkidle');
  // 1. empty submit
  const nav = p.waitForResponse(r => r.request().method()==='GET' && r.headers()['x-inertia']).catch(()=>null);
  await p.getByRole('button', { name: 'Save and add sections' }).click();
  const r = await nav; if (r) console.log('ERRORS', JSON.stringify((await r.json()).props.errors));
  await p.waitForTimeout(1500);
  console.log('---AFTER EMPTY', await p.locator('form').first().innerText());
  console.log('invalid attrs', await p.locator('[aria-invalid="true"]').count());
  const errEls = await p.locator('form p, form span').filter({hasText:/./}).allInnerTexts(); console.log('texts', errEls);
  console.log('error html', (await p.locator('[data-field="title"]').innerHTML()).slice(0,1500));
  await p.screenshot({ path: 'explore/empty.png', fullPage:true });
  // 2. long title + seconds 75 + negative minutes
  await p.locator('#title').fill('x'.repeat(300));
  await p.locator('#placement_time_limit_minutes').fill('-5');
  await p.locator('#placement_time_limit_seconds').fill('75');
  const nav2 = p.waitForResponse(r => r.request().method()==='GET' && r.headers()['x-inertia']).catch(()=>null);
  await p.getByRole('button', { name: 'Save and add sections' }).click();
  await p.waitForTimeout(2500);
  console.log('URL after2', p.url());
  console.log('validity minutes', await p.locator('#placement_time_limit_minutes').evaluate(e=>e.validationMessage));
  console.log('---AFTER2', await p.locator('form').first().innerText());
  await b.close();
})();
