import { test, expect, type SuiteTag } from './fixtures';
import type { ValuableItem } from './pages/types';

const items: { name: ValuableItem; label: string; tag: SuiteTag[] }[] = [
  { name: 'jewelry', label: 'Jewelry', tag: ['@smoke', '@sanity'] },
  { name: 'bicycles', label: 'Bicycles', tag: ['@sanity'] },
  { name: 'cameras', label: 'Cameras', tag: ['@sanity'] },
  { name: 'musical instruments', label: 'Musical instruments', tag: ['@sanity'] },
  { name: 'fine art', label: 'Fine art', tag: ['@sanity'] },
];

test.describe('Extra coverage for valuable items', { tag: '@regression' }, () => {
  for (const { name, label, tag } of items) {
    const title = `${label}: adding raises the price by the advertised amount, removing restores it`;
    test(title, { tag }, async ({ quote }) => {
      const base = await quote.price();

      const surcharge = await quote.addValuableItem(name);
      expect(surcharge).toBeGreaterThan(0);
      await quote.expectPrice(base + surcharge);
      await expect(quote.valuableItem(name).priceLabel).toHaveText(`+$${surcharge.toFixed(2)}/MO`);

      await quote.removeValuableItem(name);
      await quote.expectPrice(base);
    });
  }

  test('surcharges of multiple items add up', async ({ quote }) => {
    const base = await quote.price();

    const jewelry = await quote.addValuableItem('jewelry');
    const cameras = await quote.addValuableItem('cameras');
    await quote.expectPrice(base + jewelry + cameras);

    await quote.removeValuableItem('jewelry');
    await quote.expectPrice(base + cameras);
    await quote.removeValuableItem('cameras');
    await quote.expectPrice(base);
  });
});
