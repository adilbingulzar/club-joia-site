/*
 * The tickets on sale, one per membership tier and day package.
 *
 *   id       "<tier>/<package>", as the site's tickets (lib/config.ts)
 *   name     the site's ticket name exactly ("Ruby Red, 3 days"): the site finds the ticket by it
 *   price    in SHOP_CURRENCY (AED), per ticket
 *   tier     slug of the membership tier the buyer gets (membership_tiers.slug)
 *   codes    codes of the event's ticket types the buyer gets for each ticket bought
 *            (ticket_types.code, members app: Admin > Tickets)
 *   stock    how many can be sold, null for no limit
 *   visible  false takes it off sale
 *
 * Prices are placeholders for now.
 */
export type Product = { id: string; name: string; price: number; tier: string; codes: string[]; stock: number | null; visible: boolean };

const tiers = [
  { slug: 'ruby-red', name: 'Ruby Red', prices: { '3-days': 8000, 'sat-sun': 6800, 'fri-sun': 5200, 'fri-sat': 4000 }, extra: [] as string[] },
  { slug: 'pearly-white', name: 'Pearly White', prices: { '3-days': 10000, 'sat-sun': 8500, 'fri-sun': 6500, 'fri-sat': 5000 }, extra: [] as string[] },
  // VVIP parking is an Ultra Black perk
  { slug: 'ultra-black', name: 'Ultra Black', prices: { '3-days': 15000, 'sat-sun': 12750, 'fri-sun': 9750, 'fri-sat': 7500 }, extra: ['PARK'] }
];

// AFTER (the after-race celebration on Sunday) comes with every package that has Sunday
const packages = [
  { id: '3-days', name: '3 days', codes: ['FRI', 'SAT', 'SUN', 'AFTER'] },
  { id: 'sat-sun', name: 'Saturday & Sunday', codes: ['SAT', 'SUN', 'AFTER'] },
  { id: 'fri-sun', name: 'Friday & Sunday', codes: ['FRI', 'SUN', 'AFTER'] },
  { id: 'fri-sat', name: 'Friday & Saturday', codes: ['FRI', 'SAT'] }
] as const;

export const products: Product[] = [];
tiers.forEach(function (t) {
  packages.forEach(function (p) {
    products.push({
      id: t.slug + '/' + p.id,
      name: t.name + ', ' + p.name,
      price: t.prices[p.id],
      tier: t.slug,
      codes: (p.codes as readonly string[]).concat(t.extra),
      stock: null,
      visible: true
    });
  });
});

// a product on sale, by id
export function product(id: string): Product | null {
  return products.find(function (p) { return p.id === id && p.visible; }) || null;
}
