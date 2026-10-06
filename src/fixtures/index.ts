import { test as base, Page, Browser, BrowserContextOptions } from '@playwright/test';
import { env, paths } from '@config/env';
import { routes } from '@data/routes';
import { KanbanBoard } from '@pages/admin/KanbanBoard';
import { LeadCard } from '@pages/admin/LeadCard';
import { SuitableGroupPage } from '@pages/admin/SuitableGroupPage';
import { PlacementTestsPage } from '@pages/admin/PlacementTestsPage';
import { PlacementTestPage } from '@pages/public/PlacementTestPage';
import { PlacementTestsApi } from '@api/PlacementTestsApi';

type Boards = { callCenter: KanbanBoard; community: KanbanBoard; administration: KanbanBoard };

type Fixtures = {
  boards: Boards;
  leadCard: LeadCard;
  suitableGroups: SuitableGroupPage;
  placementTests: PlacementTestsPage;
  /** Placement tests created over HTTP; everything it created is deleted after the test. */
  placementTestsApi: PlacementTestsApi;
  /** The public placement test site in its own tab (the admin stays on `page`). */
  publicPlacement: PlacementTestPage;
  /** Opens a page in a fresh context: logged in as CEO by default, `{ anonymous: true }` for a guest. */
  newPage: (options?: { anonymous?: boolean } & BrowserContextOptions) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  boards: async ({ page }, use) => {
    await use({
      callCenter: new KanbanBoard(page, routes.boards.callCenter),
      community: new KanbanBoard(page, routes.boards.community),
      administration: new KanbanBoard(page, routes.boards.administration),
    });
  },
  leadCard: async ({ page }, use) => use(new LeadCard(page)),
  suitableGroups: async ({ page }, use) => use(new SuitableGroupPage(page)),
  placementTests: async ({ page }, use) => use(new PlacementTestsPage(page)),

  placementTestsApi: async ({ page }, use) => {
    const api = new PlacementTestsApi(page);
    await use(api);
    await api.cleanup();
  },

  publicPlacement: async ({ context }, use) => {
    const tab = await context.newPage();
    await use(new PlacementTestPage(tab));
    await tab.close();
  },

  newPage: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<Browser['newContext']>>[] = [];
    await use(async ({ anonymous, ...options } = {}) => {
      const ctx = await browser.newContext({
        baseURL: env.baseUrl,
        storageState: anonymous ? { cookies: [], origins: [] } : paths.storageState,
        ...options,
      });
      contexts.push(ctx);
      return ctx.newPage();
    });
    for (const ctx of contexts) await ctx.close();
  },
});

export { expect } from '@playwright/test';
