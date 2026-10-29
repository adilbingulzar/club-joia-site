/*
 * Club JOIA 300 — ticket catalogue and payment settings.
 * Edit this file to change access levels, day packages, benefits or where buyers pay.
 * Every ticket = one access level + one day package.
 * Prices, currency and sold out come from Alfred (lib/catalog), matched by ticket name.
 */

export type Package = { id: string; name: string; dates: string };

export type Tier = {
  id: string;
  name: string;
  swatch: string;
  page: string;
  card: string;
  intro: string;
  perks: string[];
  newFrom: number;
  prices: Record<string, number>;
};

export type Ticket = {
  id: string;
  tier: Tier;
  pkg: Package;
  name: string;
  swatch: string;
  price: number;
  soldOut: boolean;
  paymentLink: string;
};

const packages: Package[] = [
  { id: '3-days',  name: '3 days',              dates: 'Friday, Saturday & Sunday, December 4, 5 & 6' },
  { id: 'sat-sun', name: 'Saturday & Sunday',   dates: 'December 5 & 6' },
  { id: 'fri-sun', name: 'Friday & Sunday',     dates: 'December 4 & 6' },
  { id: 'fri-sat', name: 'Friday & Saturday',   dates: 'December 4 & 5' }
];

const rubyPerks = [
  'Open bar',
  'Premium food',
  'Track viewing',
  'DJ / entertainment',
  'After-race celebrations',
  'Networking with peers',
  'Shuttle service',
  'Membership application'
];
const pearlyPerks = rubyPerks.concat([
  'Priority seating / deck zone',
  'Chauffeur transfers',
  'Premium F&B',
  'VIP lounge access',
  'Fast-track marina logistics'
]);
const ultraPerks = pearlyPerks.concat([
  'Private chauffeur',
  'VVIP parking',
  'Premium plus F&B',
  'Reserved table and seating',
  'Dedicated waiter'
]);

const tiers: Tier[] = [
  {
    id: 'ruby-red', name: 'Ruby Red', swatch: 'ruby', page: '/ruby-red',
    card: '/assets/img/cards/ruby-red.webp',
    intro: 'The essential Club JOIA 300 experience: open bar, premium food and the best view of the track.',
    perks: rubyPerks, newFrom: 0,
    prices: { '3-days': 8000, 'sat-sun': 6800, 'fri-sun': 5200, 'fri-sat': 4000 }
  },
  {
    id: 'pearly-white', name: 'Pearly White', swatch: 'pearl', page: '/pearly-white',
    card: '/assets/img/cards/pearly-white.webp',
    intro: 'Everything in Ruby Red, plus priority deck seating, chauffeur transfers and VIP lounge access.',
    perks: pearlyPerks, newFrom: rubyPerks.length,
    prices: { '3-days': 10000, 'sat-sun': 8500, 'fri-sun': 6500, 'fri-sat': 5000 }
  },
  {
    id: 'ultra-black', name: 'Ultra Black', swatch: 'black', page: '/ultra-black',
    card: '/assets/img/cards/ultra-black.webp',
    intro: 'The top tier: everything in Pearly White, plus a private chauffeur, a reserved table and a dedicated waiter.',
    perks: ultraPerks, newFrom: pearlyPerks.length,
    prices: { '3-days': 15000, 'sat-sun': 12750, 'fri-sun': 9750, 'fri-sat': 7500 }
  }
];

/*
 * Optional per-ticket settings, keyed by "<tier>/<package>":
 *   soldOut:     true hides the quantity buttons
 *   paymentLink: e.g. a Stripe Payment Link for that exact ticket
 */
const ticketSettings: Record<string, { soldOut?: boolean; paymentLink?: string }> = {
  // 'ultra-black/3-days': { soldOut: true },
  // 'ruby-red/fri-sat':   { paymentLink: 'https://buy.stripe.com/...' }
};

// Flat list of every purchasable ticket, built from the tables above.
const tickets: Ticket[] = [];
tiers.forEach(function (t) {
  packages.forEach(function (p) {
    const extra = ticketSettings[t.id + '/' + p.id] || {};
    tickets.push({
      id: t.id + '/' + p.id,
      tier: t,
      pkg: p,
      name: t.name + ', ' + p.name,
      swatch: t.swatch,
      price: t.prices[p.id],
      soldOut: !!extra.soldOut,
      paymentLink: extra.paymentLink || ''
    });
  });
});

export const CJ_CONFIG = {
  currency: 'USD',
  maxPerTicket: 10, // max quantity of one ticket per order
  packages: packages,
  tiers: tiers,
  tickets: tickets,

  payment: {
    /*
     * Preferred: an endpoint on your server that creates ONE checkout for the
     * whole order. The site POSTs JSON:
     *   { items: [{ id, quantity }], buyer: { ...checkout form }, successUrl, cancelUrl }
     * where id is "<tier>/<package>", e.g. "ruby-red/3-days",
     * and expects back: { url: "https://checkout.gateway.com/..." }
     * Prices must be looked up on the server, never trusted from the browser.
     */
    // Our own route (app/api/checkout) that books the order in Alfred, see README.
    checkoutEndpoint: '/api/checkout',

    // Alfred's fee for also sending the tickets by SMS (TICKETING_SMS_FEE, usd).
    smsFee: 1,

    /*
     * Payment gateways the buyer chooses from, `engine` as Alfred names it.
     * The buyer's country selects the gateway listing it (else defaultGateway);
     * the buyer can still pick another one.
     */
    gateways: [
      { id: 'noon',         name: 'noon',         engine: 'noon',          countries: ['AE'] },
      { id: 'multisafepay', name: 'MultiSafepay', engine: 'multisafe pay', countries: [] as string[] },
      { id: 'paynl',        name: 'Pay.nl',       engine: 'paynl',         countries: ['NL', 'BE'] }
    ],
    defaultGateway: 'multisafepay',

    /*
     * Fallback when no endpoint is set: if the order holds a single ticket,
     * the buyer is sent to that ticket's `paymentLink`. Enable
     * "customer can adjust quantity" on the link so they can confirm the count.
     */
    useTicketLinks: true
  }
};

export type Gateway = (typeof CJ_CONFIG.payment.gateways)[number];

export function gateway(id: string): Gateway | null {
  return CJ_CONFIG.payment.gateways.filter(function (g) { return g.id === id; })[0] || null;
}

// The gateway suggested for a country code ("AE"), see payment.gateways.
export function gatewayFor(countryCode: string): string {
  const g = CJ_CONFIG.payment.gateways.filter(function (g) { return g.countries.indexOf(countryCode) >= 0; })[0];
  return g ? g.id : CJ_CONFIG.payment.defaultGateway;
}

export function ticket(id: string): Ticket | null {
  for (let i = 0; i < tickets.length; i++) if (tickets[i].id === id) return tickets[i];
  return null;
}

export function money(n: number, currency: string = CJ_CONFIG.currency): string {
  return currency + ' ' + n.toLocaleString('en-US');
}

// What Alfred says about the tickets (lib/catalog), by ticket id ("ruby-red/3-days").
export type Catalog = {
  currency: string; // ISO code, "AED"
  live: boolean;    // false: Alfred couldn't be reached, no prices
  tickets: Record<string, { price: number | null; soldOut: boolean }>; // price null: not on sale in Alfred
};

export function unavailableCatalog(): Catalog {
  return { currency: '', live: false, tickets: {} };
}
