/*
 * The currencies a buyer can pay in. The shop's prices are in its own currency (SHOP_CURRENCY,
 * lib/shop/products.ts); when that is USD the buyer can pay in AED too, at the dirham's fixed peg
 * to the dollar (3.6725), each ticket's price rounded to a whole dirham. Used by the site's pages
 * (lib/prices.tsx) and the shop (lib/shop/orders.ts), so the price shown is the price charged.
 */
export const AED_PER_USD = 3.6725;

/** The currencies an order can be paid in, the shop's own first. */
export function payCurrencies(base: string): string[] {
  const b = String(base || '').toUpperCase();
  return b === 'USD' ? ['USD', 'AED'] : b ? [b] : [];
}

/** A price in the shop's currency as the price in `to` (one of payCurrencies(base)). */
export function convert(amount: number, base: string, to: string): number {
  const b = String(base || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  if (!t || t === b) return amount;
  if (b === 'USD' && t === 'AED') return Math.round(amount * AED_PER_USD);
  throw new Error('no rate from ' + b + ' to ' + t);
}

/** The currency asked for when it is one the order can be paid in, else the shop's own. */
export function payCurrency(base: string, asked: unknown): string {
  const list = payCurrencies(base);
  const a = typeof asked === 'string' ? asked.trim().toUpperCase() : '';
  return list.indexOf(a) >= 0 ? a : list[0] || String(base || '').toUpperCase();
}
