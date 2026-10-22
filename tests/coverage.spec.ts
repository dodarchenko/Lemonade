import { test, expect, type SuiteTag } from './fixtures';
import type { Coverage } from './pages/types';

// `startsAt`: the end of its range the quote's amount starts at, so the one-step test moves away from it.
// `tag`: extra suites for the one-step test (every test here is @regression).
const coverages: { name: Coverage; startsAt: 'min' | 'max'; tag: SuiteTag[] }[] = [
  { name: 'Personal Property', startsAt: 'max', tag: ['@smoke', '@sanity'] },
  { name: 'Personal Liability', startsAt: 'min', tag: ['@sanity'] },
  { name: 'Loss of use', startsAt: 'min', tag: ['@sanity'] },
  { name: 'Medical payments to others', startsAt: 'min', tag: ['@sanity'] },
];

test.describe('Coverage amounts', { tag: '@regression' }, () => {
  for (const { name, startsAt, tag } of coverages) {
    test(`${name}: one step changes the price and stepping back restores it`, { tag }, async ({ quote }) => {
      const base = await quote.price();

      // Step away from the end of the range the amount starts at, then back.
      const [away, back] =
        startsAt === 'min' ? (['increase', 'decrease'] as const) : (['decrease', 'increase'] as const);

      const { from, to, price } = await quote.stepCoverage(name, away);
      if (away === 'increase') expect(price, `${from} -> ${to}`).toBeGreaterThan(base);
      else expect(price, `${from} -> ${to}`).toBeLessThan(base);

      await quote.stepCoverage(name, back);
      await quote.expectPrice(base);
    });

    test(`${name}: price rises with every step across the full range`, async ({ quote }) => {
      const base = await quote.price();

      const points = await quote.pricesAcrossRange(name);
      // Soft: a bad step fails the test but the rest are still checked, so the report lists every broken step.
      for (let i = 1; i < points.length; i++) {
        const [prev, next] = [points[i - 1], points[i]];
        expect.soft(next.price, `${prev.amount} -> ${next.amount}`).toBeGreaterThan(prev.price);
      }
      await quote.expectPrice(base);
    });
  }

  test('each coverage starts at the end of its range listed above', async ({ quote }) => {
    for (const { name, startsAt } of coverages) {
      const { increase, decrease } = quote.coverage(name);
      await expect(startsAt === 'max' ? increase : decrease, `${name} should start at its ${startsAt}`).toBeDisabled();
    }
  });
});
