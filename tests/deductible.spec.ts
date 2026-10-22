import { test, expect } from './fixtures';

test.describe('Deductible', { tag: '@regression' }, () => {
  test('lower deductible costs more, higher costs less than the default $500', {
    tag: ['@smoke', '@sanity'],
  }, async ({ quote }) => {
    await expect(quote.deductibleValue).toHaveText('$500');
    const base = await quote.price();

    expect(await quote.selectDeductible('$250')).toBeGreaterThan(base);
    expect(await quote.selectDeductible('$1,000')).toBeLessThan(base);
  });

  test('price strictly decreases as the deductible goes up', async ({ quote }) => {
    const base = await quote.price();

    const price = await quote.priceForEachDeductible();
    expect(price['$500'], '$500 should match the original quote').toBeCloseTo(base, 2);
    expect(price['$250']).toBeGreaterThan(price['$500']);
    expect(price['$500']).toBeGreaterThan(price['$1,000']);
    expect(price['$1,000']).toBeGreaterThan(price['$2,500']);
  });
});
