import { defineConfig, devices } from '@playwright/test';

/**
 * Environment variables:
 *  - BASE_URL    site under test (default: the public mock)
 *  - QUOTE_PATH  quote to open, see tests/pages/QuotePage.ts
 *  - CI          enables retries, forbids test.only, and switches reporters
 */
const baseURL = process.env.BASE_URL || 'https://lemonade-hq.github.io';

/**
 * Pre-answers the cookie banner, so no test has to click it. The site hides the banner when
 * `_lmnd_cookie_banner_accepted` exists; we store "rejected, essential cookies only".
 * A test that needs the banner can opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
const cookieConsent = [
  { name: '_lmnd_cookie_banner_accepted', value: 'false' },
  { name: '_lmnd_cookie_types_enabled', value: 'essential' },
].map((cookie) => ({
  ...cookie,
  domain: new URL(baseURL).hostname,
  path: '/',
  expires: -1, // session cookie
  httpOnly: false,
  secure: baseURL.startsWith('https:'),
  sameSite: 'Lax' as const,
}));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* Tests are independent (fresh page each), so CI runners can use both cores. */
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list'], ['html']],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState: { cookies: cookieConsent, origins: [] },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    /*
     * WebKit is intentionally excluded: the mock site's boot script strips the GitHub Pages repo prefix by
     * patching Location.prototype.pathname, which WebKit doesn't honour (pathname is an own, unforgeable
     * property there), so the app never leaves "Loading Lemonade renters quote...". Not a pricing issue.
     */
  ],
});
