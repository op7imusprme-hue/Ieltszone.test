import { Page, expect } from '@playwright/test';

/**
 * Run `action` (a click that submits a form) and check the non-GET request it sends to `path`.
 * The success toast is not shown after every action (e.g. a lead update), so it can't be relied on.
 * A failed validation is also a 302/303 redirect: its errors come back in the redirected Inertia page props.
 */
export async function submit(page: Page, path: string | RegExp, action: () => Promise<void>) {
  const sent = page.waitForResponse(r => {
    if (r.request().method() === 'GET') return false;
    const pathname = new URL(r.url()).pathname;
    return typeof path === 'string' ? pathname === path : path.test(pathname);
  });
  await action();
  const res = await sent;
  expect(res.status(), `${res.request().method()} ${res.url()}`).toBeLessThan(400);
  const redirected = await res.request().redirectedTo()?.response();
  if (redirected?.headers()['x-inertia']) {
    const body = await redirected.json().catch(() => null);
    expect(body?.props?.errors ?? {}, 'validation errors').toEqual({});
  }
}

/** Headers of a state-changing request as the Laravel app expects them (CSRF from the XSRF-TOKEN cookie). */
export async function xsrfHeaders(page: Page, url?: string) {
  const cookie = (await page.context().cookies(url)).find(c => c.name === 'XSRF-TOKEN');
  expect(cookie, 'XSRF-TOKEN cookie').toBeTruthy();
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie!.value), 'X-Requested-With': 'XMLHttpRequest' };
}
