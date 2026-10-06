const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const anon = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz' });
  const a = await anon.newPage();
  for (const u of ['/admin/placement-test','/admin/placement-test/create','/admin/placement-test/254/edit']) { const r = await a.goto(u); console.log('ANON', u, '->', a.url(), r.status()); }
  const post = await anon.request.post('/admin/placement-test', { data: { title:'x', course_ids:[1] }, headers:{'X-Inertia':'true', Accept:'application/json'}, maxRedirects:0 });
  console.log('ANON POST', post.status(), post.headers()['location']);
  const del = await anon.request.delete('/admin/placement-test/254', { maxRedirects:0 }); console.log('ANON DELETE', del.status(), del.headers()['location']);
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json' });
  const p = await ctx.newPage();
  const r404 = await p.goto('/admin/placement-test/99999999'); console.log('404?', r404.status(), (await p.locator('body').innerText()).slice(0,200));
  const rx = await p.goto("/admin/placement-test/abc'"); console.log('abc?', rx.status());
  const csrf = await ctx.request.post('/admin/placement-test', { data: { title:'csrf', course_ids:[1] }, maxRedirects:0 }); console.log('CSRF (no token)', csrf.status());
  // public site
  const pt = await (await b.newContext()).newPage();
  await pt.goto('https://demo.ieltszoneapp.uz/placement-test'); await pt.waitForLoadState('networkidle');
  console.log('---PUBLIC', await pt.locator('body').innerText());
  console.log('input attrs', await pt.locator('#placement-test-lead-id').evaluate(e=>e.outerHTML));
  pt.on('response', r => { if (r.request().method()!=='GET') console.log('  PRESP', r.url(), r.status(), r.request().postData()); });
  const tryId = async (v) => { await pt.goto('https://demo.ieltszoneapp.uz/placement-test'); await pt.locator('#placement-test-lead-id').fill(v).catch(e=>console.log('fill fail', v)); await pt.locator('button[type=submit]').click(); await pt.waitForTimeout(2500); console.log('ID', JSON.stringify(v), '->', pt.url(), '|', (await pt.locator('body').innerText()).replace(/\s+/g,' ').slice(0,300), '| validity:', await pt.locator('#placement-test-lead-id').evaluate(e=>e.validationMessage).catch(()=>'-')); };
  for (const v of ['', '99999999', 'abc', "1' OR '1'='1", '-1', '0', '<script>alert(1)</script>']) await tryId(v);
  await b.close();
})();
