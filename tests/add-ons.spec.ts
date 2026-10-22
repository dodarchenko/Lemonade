import { test, type SuiteTag } from './fixtures';
import type { AddOn, AddOnOptions } from './pages/types';

const addOns: ({ id: AddOn; label: string; tag: SuiteTag[] } & AddOnOptions)[] = [
  { id: 'water_backup', label: 'Water back-up', tag: ['@smoke', '@sanity'] },
  {
    id: 'secondary_insured',
    label: 'Spouse',
    tag: ['@smoke', '@sanity'],
    fields: { 'First name': 'Jane', 'Last name': 'Doe' },
  },
  {
    id: 'other_members_of_household',
    label: 'Significant other',
    tag: ['@sanity'],
    fields: { 'First name': 'Sam', 'Last name': 'Lee' },
  },
  { id: 'landlord_property_damage', label: 'Landlord property damage', tag: ['@sanity'] },
  { id: 'equipment_breakdown', label: 'Equipment breakdown', tag: ['@sanity'], popup: false },
  {
    id: 'interested_party',
    label: 'Interested party/Landlord',
    tag: ['@sanity'],
    fields: { Name: 'Pat Landlord', Address: '1 Main St, Buffalo, NY 14201', Email: 'landlord@example.com' },
  },
];

test.describe('Policy add-ons', { tag: '@regression' }, () => {
  for (const { id, label, tag, ...options } of addOns) {
    const title = `${label}: toggling on adds its listed price (none if Free), toggling off restores it`;
    test(title, { tag }, async ({ quote }) => {
      const base = await quote.price();
      const listed = await quote.addOnListedPrice(id);

      await quote.enableAddOn(id, options);
      await quote.expectPrice(base + listed);

      await quote.disableAddOn(id);
      await quote.expectPrice(base);
    });
  }

  test('add-on and valuable item surcharges stack', async ({ quote }) => {
    const base = await quote.price();

    const item = await quote.addValuableItem('bicycles');
    const addOn = await quote.addOnListedPrice('equipment_breakdown');
    await quote.enableAddOn('equipment_breakdown', { popup: false });
    await quote.expectPrice(base + item + addOn);
  });
});
