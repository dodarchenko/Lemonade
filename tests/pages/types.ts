/** The values the quote page accepts. Using these types turns a typo (e.g. 'Loss of Use') into a compile error. */

export type Coverage = 'Personal Property' | 'Personal Liability' | 'Loss of use' | 'Medical payments to others';

export type Direction = 'increase' | 'decrease';

export type ValuableItem = 'jewelry' | 'bicycles' | 'cameras' | 'musical instruments' | 'fine art';

export type AddOn =
  | 'interested_party'
  | 'secondary_insured' // Spouse
  | 'other_members_of_household' // Significant other
  | 'water_backup'
  | 'landlord_property_damage'
  | 'equipment_breakdown';

export const DEDUCTIBLES = ['$250', '$500', '$1,000', '$2,500'] as const;
export type Deductible = (typeof DEDUCTIBLES)[number];

/**
 * How an add-on is switched on: `popup: false` toggles straight on;
 * otherwise its popup is confirmed after filling `fields` (label -> value).
 */
export type AddOnOptions = { popup?: boolean; fields?: Record<string, string> };
