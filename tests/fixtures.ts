import { test as base } from '@playwright/test';
import { QuotePage } from './pages/QuotePage';

/**
 * Suites are nested (smoke ⊂ sanity ⊂ regression). Every describe block carries `@regression`,
 * so tests only list the smaller suites they're also in. Run one with `--grep @smoke` etc.
 */
export type SuiteTag = '@smoke' | '@sanity';

/** Every test gets a freshly opened quote. */
export const test = base.extend<{ quote: QuotePage }>({
  quote: async ({ page }, use) => {
    const quote = new QuotePage(page);
    await quote.open();
    await use(quote);
  },
});

export { expect } from '@playwright/test';
