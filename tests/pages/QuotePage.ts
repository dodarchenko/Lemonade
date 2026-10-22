import { expect, type Locator, type Page } from '@playwright/test';
import {
  DEDUCTIBLES,
  type AddOn,
  type AddOnOptions,
  type Coverage,
  type Deductible,
  type Direction,
  type ValuableItem,
} from './types';

/** Overridable per environment, since other deployments may seed a different quote. */
export const QUOTE_PATH = process.env.QUOTE_PATH || '/qa-interview-task/quotes/LQ42EE07089';

/** "$1,234.56" -> 1234.56 */
export function parseMoney(text: string): number {
  const match = text.match(/\$([\d,]+(?:\.\d+)?)/);
  if (!match) throw new Error(`No dollar amount found in "${text}"`);
  return Number(match[1].replace(/,/g, ''));
}

export class QuotePage {
  private readonly payButton: Locator;
  private readonly dialog: Locator;
  private readonly confirmYes: Locator;

  constructor(readonly page: Page) {
    // The page has two identical "Pay $X / month" buttons (top and bottom), so a role locator would be ambiguous.
    this.payButton = page.locator('#gtm_button_pay_main');
    // Not getByRole('dialog'): each <dialog> wraps an inner role="dialog", which would match twice.
    this.dialog = page.locator('dialog[open]');
    this.confirmYes = this.dialog.getByRole('button', { name: 'Yes' });
  }

  /** Opens the quote. */
  async open() {
    await this.page.goto(QUOTE_PATH);
    // Wait for a real "$12.34" price, so tests never start from a placeholder.
    await expect(this.payButton).toHaveText(/\$\d+\.\d{2}/);
  }

  // ---- Price ----

  /** Monthly price as shown on the main "Pay $X / month" button. */
  async price(): Promise<number> {
    return parseMoney(await this.payButton.innerText());
  }

  async expectPrice(expected: number) {
    await expect.poll(() => this.price()).toBeCloseTo(expected, 2);
  }

  /**
   * The price after a change, once it has had a chance to update. Returns the unchanged price
   * (instead of failing) when it doesn't move, so the test's own assertion reports the problem.
   */
  private async settledPrice(before: number): Promise<number> {
    const deadline = Date.now() + 2_000;
    let current = await this.price();
    while (current === before && Date.now() < deadline) {
      await this.page.waitForTimeout(100);
      current = await this.price();
    }
    return current;
  }

  /**
   * Removing things may or may not ask "Are you sure?". Keeps answering "Yes" until `done` passes,
   * instead of guessing whether the dialog is about to appear.
   */
  private async confirmUntil(done: () => Promise<void>) {
    await expect(async () => {
      if (await this.confirmYes.isVisible()) await this.confirmYes.click();
      await done();
    }).toPass({ timeout: 10_000 });
  }

  /** The block a heading introduces, e.g. a coverage row or the deductible section. */
  private sectionOf(heading: string) {
    return this.page.getByRole('heading', { name: heading, exact: true }).locator('..');
  }

  // ---- Coverage amounts ----

  coverage(name: Coverage) {
    // Only coverage rows have +/- buttons. "What's Covered" repeats some headings
    // (e.g. "Medical Payments to Others"), so don't rely on the heading alone.
    const row = this.sectionOf(name).filter({ has: this.page.getByRole('button', { name: 'increase' }) });
    return {
      value: row.getByLabel('input-value'),
      increase: row.getByRole('button', { name: 'increase' }),
      decrease: row.getByRole('button', { name: 'decrease' }),
    };
  }

  /**
   * Clicks + or - once; returns the amounts before and after and the new price,
   * e.g. { from: '$15,000', to: '$20,000', price: 14.73 }.
   */
  async stepCoverage(name: Coverage, direction: Direction) {
    const { value, [direction]: button } = this.coverage(name);
    const from = await value.innerText();
    const before = await this.price();
    await button.click();
    await expect(value).not.toHaveText(from);
    return { from, to: await value.innerText(), price: await this.settledPrice(before) };
  }

  /**
   * The price at every amount of a coverage, from its minimum to its maximum, e.g.
   * [{ amount: '$15,000', price: 14.33 }, { amount: '$20,000', price: 14.73 }, …].
   * Leaves the coverage at the amount it started at.
   */
  async pricesAcrossRange(name: Coverage) {
    const { value, increase, decrease } = this.coverage(name);
    const initial = await value.innerText();

    while (await decrease.isEnabled()) await this.stepCoverage(name, 'decrease');
    const points = [{ amount: await value.innerText(), price: await this.price() }];
    while (await increase.isEnabled()) {
      const { to, price } = await this.stepCoverage(name, 'increase');
      points.push({ amount: to, price });
    }
    while ((await value.innerText()) !== initial) await this.stepCoverage(name, 'decrease');
    return points;
  }

  // ---- Valuable items (Add Extra Coverage) ----

  valuableItem(name: ValuableItem) {
    const tile = this.page.locator('#valuable-items').getByLabel(name, { exact: true });
    return {
      addButton: tile.getByRole('button', { name: 'add' }),
      deleteButton: tile.getByRole('button', { name: 'delete' }),
      /** "+$0.92/MO" label rendered on the tile once the item is added */
      priceLabel: tile.getByText(/^\+\$[\d.]+\/MO$/),
    };
  }

  /** Opens the item modal and confirms it; returns the monthly surcharge advertised by the modal. */
  async addValuableItem(name: ValuableItem): Promise<number> {
    const item = this.valuableItem(name);
    await item.addButton.click();
    const confirm = this.dialog.getByRole('button', { name: /^Add \(\+\$[\d.]+\)\/MO/i });
    const surcharge = parseMoney(await confirm.innerText());
    // The confirm button is two-staged ("Add" -> "Got it"); keep clicking until the modal closes.
    await expect(async () => {
      await confirm.click({ timeout: 1_000 });
      await expect(this.dialog).toBeHidden({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(item.deleteButton).toBeVisible();
    return surcharge;
  }

  async removeValuableItem(name: ValuableItem) {
    const item = this.valuableItem(name);
    await item.deleteButton.click();
    await this.confirmUntil(() => expect(item.addButton).toBeVisible({ timeout: 500 }));
  }

  // ---- Policy options (add-ons) ----

  addOn(id: AddOn) {
    const row = this.page.locator(`#addon-${id}`);
    return {
      checkbox: row.getByRole('checkbox'),
      // The checkbox itself is visually hidden; users click its "Toggle" label.
      toggle: row.getByText('Toggle', { exact: true }),
      // Water back-up renders "Starts from +$0.83/MO", so don't anchor the regex.
      priceTag: row.getByText(/^Free$|\+\$[\d.]+\/MO/),
    };
  }

  /** Price listed on the add-on row; 0 for "Free". */
  async addOnListedPrice(id: AddOn): Promise<number> {
    // innerText applies the page's CSS uppercasing ("FREE"), hence the case-insensitive compare.
    const text = await this.addOn(id).priceTag.innerText();
    return text.trim().toLowerCase() === 'free' ? 0 : parseMoney(text);
  }

  async enableAddOn(id: AddOn, { popup = true, fields = {} }: AddOnOptions = {}) {
    const addOn = this.addOn(id);
    await addOn.toggle.click();
    if (popup) {
      for (const [label, value] of Object.entries(fields)) {
        // These inputs ignore fill(); they only enable the confirm button on real key presses.
        await this.dialog.getByLabel(label, { exact: true }).pressSequentially(value);
      }
      await this.dialog.getByRole('button', { name: /^Add/ }).click();
      await expect(this.dialog).toBeHidden();
    }
    await expect(addOn.checkbox).toBeChecked();
  }

  async disableAddOn(id: AddOn) {
    const addOn = this.addOn(id);
    await addOn.toggle.click();
    await this.confirmUntil(() => expect(addOn.checkbox).not.toBeChecked({ timeout: 500 }));
  }

  // ---- Deductible ----

  // Scoped to its section: the page has other `select` dropdowns (e.g. Start Date).
  private get deductibleSelect() {
    return this.sectionOf('Deductible').getByTestId('select');
  }

  /** The currently selected deductible, e.g. "$500". */
  get deductibleValue() {
    return this.deductibleSelect.getByTestId('select-header');
  }

  /** Selects a deductible and returns the new monthly price. */
  async selectDeductible(value: Deductible): Promise<number> {
    const before = await this.price();
    await this.deductibleSelect.click();
    await this.deductibleSelect.getByRole('option', { name: value, exact: true }).click();
    await expect(this.deductibleValue).toHaveText(value);
    return this.settledPrice(before);
  }

  /** The monthly price for every deductible, e.g. { '$250': 15.9, '$500': 14.33, … }. */
  async priceForEachDeductible(): Promise<Record<Deductible, number>> {
    const prices = {} as Record<Deductible, number>;
    for (const value of DEDUCTIBLES) {
      prices[value] = await this.selectDeductible(value);
    }
    return prices;
  }
}
