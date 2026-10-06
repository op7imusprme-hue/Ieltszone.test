const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.request().method()!=='GET') console.log('  RESP', r.request().method(), new URL(r.url()).pathname, r.status(), (r.request().postData()||'').slice(0,200)); });
  p.on('dialog', d => { console.log('ALERT FIRED', d.message()); d.dismiss(); });
  const r = await p.goto('/admin/placement-test'); const h = r.headers();
  console.log('HEADERS', ['x-frame-options','content-security-policy','x-content-type-options','strict-transport-security','referrer-policy'].map(k=>k+'='+h[k]));
  const cookies = await ctx.cookies(); console.log(cookies.map(c=>`${c.name} httpOnly=${c.httpOnly} secure=${c.secure} sameSite=${c.sameSite}`));
  // edit 259 with XSS title
  await p.goto('/admin/placement-test/259/edit'); await p.waitForLoadState('networkidle');
  await p.locator('#title').fill('<img src=x onerror=alert(1)>AT xss');
  await p.getByRole('button', { name: 'Saqlash' }).click(); await p.waitForTimeout(2500);
  console.log('after edit url', p.url());
  await p.goto('/admin/placement-test'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1000);
  console.log('xss row', await p.locator('tr').filter({ has: p.locator('a[href$="/admin/placement-test/259"]') }).innerText());
  console.log('img injected?', await p.locator('tbody img[src="x"]').count());
  // cancel button
  await p.goto('/admin/placement-test/create'); await p.getByRole('button',{name:'Bekor qilish'}).click(); await p.waitForTimeout(1500); console.log('cancel ->', p.url());
  await p.goto('/admin/placement-test/create'); await p.getByText('Orqaga').click(); await p.waitForTimeout(1500); console.log('orqaga ->', p.url());
  // delete cancel then delete 256..259
  for (const id of [256,257,258,259]) {
    await p.goto('/admin/placement-test'); await p.waitForLoadState('networkidle');
    const row = p.locator('tr').filter({ has: p.locator(`a[href$="/admin/placement-test/${id}"]`) });
    await row.locator('button:has(svg.ri-delete-bin-6-line)').click();
    await p.getByRole('dialog').getByRole('button', { name: 'Oʻchirish' }).click(); await p.waitForTimeout(2000);
    console.log('deleted', id, await row.count(), await p.locator('.Vue-Toastification__container').allInnerTexts());
  }
  const m = await b.newContext({ baseURL: 'https://demo-main.ieltszoneapp.uz', storageState: '.auth/ceo.json', viewport:{width:375,height:812}, isMobile:true });
  const mp = await m.newPage(); await mp.goto('/admin/placement-test/create'); await mp.waitForLoadState('networkidle');
  console.log('mobile scrollW', await mp.evaluate(()=>[document.documentElement.scrollWidth, innerWidth]));
  await mp.screenshot({path:'explore/mobile.png'});
  await b.close();
})();
