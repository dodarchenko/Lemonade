# Lemonade Quote Pricing – Playwright E2E Tests

Automated end-to-end tests that check the **monthly price on the Lemonade renters quote page** goes up or down correctly when the customer changes their policy.

Page under test: <https://lemonade-hq.github.io/qa-interview-task/quotes/LQ42EE07089>

---

## Setup

**Requirements:** Node.js 18 or newer (tested on Node 24) and npm.

```bash
npm ci                                       # install dependencies
npx playwright install chromium firefox      # download the browsers
```

On Linux (or a fresh CI machine), install the browsers' system libraries too:

```bash
npx playwright install --with-deps chromium firefox
```

---

## Running the tests

| Command | What it runs |
|---|---|
| `npm test` | All tests, Chromium + Firefox |
| `npm run test:smoke` | Smoke suite (5 tests) |
| `npm run test:sanity` | Sanity suite (16 tests) |
| `npm run test:regression` | Regression suite (24 tests – everything) |
| `npm run test:headed` | All tests in a visible Chromium window |
| `npm run typecheck` | TypeScript type-check (no tests run) |
| `npm run report` | Open the HTML report from the last run |

Numbers are per browser; each suite runs on both Chromium and Firefox unless you pick one.

### Useful variations

Pass extra Playwright options after `--`:

```bash
npm run test:smoke -- --project=chromium     # one browser only
npm run test:sanity -- --headed              # watch it run
npm run test:regression -- --workers=1       # one test at a time
npx playwright test add-ons                   # one feature file
npx playwright test -g "Deductible"          # tests whose title matches
npx playwright test --ui                     # interactive UI mode
npx playwright test --list --grep @smoke     # list tests without running them
```

---

## Test suites (tags)

Tests use Playwright's built-in [tags](https://playwright.dev/docs/test-annotations#tag-tests). Every `describe` block is tagged `@regression`, which its tests inherit; tests in the smaller suites add `@sanity` and/or `@smoke`. Each suite is a single `--grep`:

| Tag | Purpose | Contents |
|---|---|---|
| `@smoke` | Quick "is pricing alive?" check | One representative test per feature |
| `@sanity` | Every option, one change each | All coverages, valuable items, add-ons + deductible smoke |
| `@regression` | Full suite | Sanity + full-range walks, boundaries, combinations, deductible ordering |

Suites are nested: smoke ⊂ sanity ⊂ regression.

```bash
npx playwright test --grep @smoke
npx playwright test --grep @sanity
npx playwright test --grep @regression
npx playwright test --grep @sanity --grep-invert @smoke   # sanity tests that aren't smoke
```

When adding a test inside an existing `describe`, it's already in regression; add `tag: ['@sanity']` for sanity, or `tag: ['@smoke', '@sanity']` for smoke. Tags in table rows are typed (`SuiteTag`), so a typo is a compile error.

---

## Known defects

The suite found two pricing bugs. Their tests fail as normal until the bugs are fixed:

| Coverage | Problem | Failing tests |
|---|---|---|
| Loss of use | Going from $20,000 to $25,000 *lowers* the price ($14.73 → $14.33, the same as $15,000) | full range |
| Medical payments to others | $1,000 → $2,000 → $3,000 → $4,000 doesn't change the price at all | one step, full range |

That's 3 failing tests per browser (6 in a full Chromium + Firefox run). A failure never stops the rest of the run: every test opens its own fresh page, and Playwright keeps running the others. On CI, each browser is its own job with `fail-fast: false`, so one browser failing doesn't cancel the other.

The full-range tests use soft assertions: they keep checking every step after a bad one, so the report lists every broken step in the range, not just the first.

---

## Browsers

- **Chromium** and **Firefox** are tested.
- **WebKit (Safari) is excluded.** The mock site's start-up script rewrites `location.pathname` in a way WebKit doesn't support, so the page never finishes loading there. This is a hosting quirk of the test site, not a pricing issue.

---

## CI (GitHub Actions)

The workflow in `.github/workflows/ci.yaml` runs automatically:

| Trigger | Suite |
|---|---|
| Pull request | sanity |
| Push to `main` / `master` | regression |
| Nightly (03:00 UTC) | regression |

It can also be started by hand from **Actions → E2E – Quote pricing → Run workflow**, with these inputs:

| Input | Options | Default |
|---|---|---|
| `environment` | production, staging, dev | production |
| `base_url` | any URL (overrides the environment's) | – |
| `tag` | smoke, sanity, regression | smoke |
| `browser` | all, chromium, firefox | all |

Each environment reads its address from a `BASE_URL` variable (and optionally `QUOTE_PATH`) set under **Settings → Environments**. Production falls back to the public mock site if none is set; staging and dev need `BASE_URL` configured before use.

Each browser runs as its own job. The HTML report is uploaded as an artifact on every run, and traces, screenshots and videos are uploaded when something fails. Failed tests are retried up to 2 times on CI.

---

## Debugging a failure

```bash
npm run report                                         # open the HTML report
npx playwright show-trace test-results/<test>/trace.zip   # step through a recorded trace
npx playwright test -g "jewelry" --headed --debug     # run one test with the inspector
```

Locally, failed tests keep a screenshot and video in `test-results/`. Traces are recorded when a test is retried (on CI).
