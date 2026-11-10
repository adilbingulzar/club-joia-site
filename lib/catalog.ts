/*
 * Prices, currency and sold out of the tickets, from the ticket shop (lib/shop, server only):
 * the event's tickets (ticketTypes, matched by name, "Ruby Red, 3 days"), how many are left of
 * each (soldOut) and the event's currency (events). The event is SHOP_EVENT.
 * Pages get the last answer at once and a newer one is fetched behind it when it is over a
 * minute old, so only the first page after a start waits for the database. When it can't be
 * reached the last answer stays, else the catalogue is unavailable (no prices, no ordering).
 */
import { CJ_CONFIG as cfg, unavailableCatalog, money, type Catalog } from './config';
import { shopConfig } from './shop/config';
import { events, soldOut, ticketTypes } from './shop/orders';

const TTL = 60 * 1000;
const RETRY = 10 * 1000; // after a failed load without an answer to show

// the event's currency ("usd", ...) as an ISO code
const CURRENCIES: Record<string, string> = { euro: 'EUR', usd: 'USD', aed: 'AED', mad: 'MAD', gbp: 'GBP' };

let cache: { at: number; catalog: Catalog } | null = null;
let pending: Promise<Catalog> | null = null;

async function load(): Promise<Catalog> {
  const eventId = shopConfig.event;
  if (!eventId) throw new Error('SHOP_EVENT must be set');

  const [types, list] = await Promise.all([ticketTypes(eventId), events()]);
  const event = list.filter(function (e) { return e.id === eventId; })[0];
  const currency = event && CURRENCIES[event.eventCurrency];
  if (!currency) throw new Error('event ' + eventId + ' is not on sale or has no currency');

  const byName: Record<string, { id: string; ticketPrice: string }> = {};
  types.forEach(function (t) {
    if (t && t.softDelete === '0' && t.ticketVisible === '1') byName[String(t.ticketDescription).trim()] = t;
  });

  const tickets: Catalog['tickets'] = {};
  await Promise.all(cfg.tickets.map(async function (t) {
    const a = byName[t.name];
    // not on sale in the shop
    if (!a) { tickets[t.id] = { price: null, soldOut: true }; return; }
    const left = await soldOut(String(a.id));
    tickets[t.id] = { price: Number(a.ticketPrice), soldOut: t.soldOut || !(Number(left && left.left_tickets) > 0) };
  }));

  return { currency, live: true, tickets };
}

function refresh(): Promise<Catalog> {
  if (!pending) {
    pending = load()
      .then(function (catalog) { cache = { at: Date.now(), catalog }; return catalog; })
      .catch(function (e) {
        console.error('catalog:', e);
        // the last answer stays for another minute, an unavailable one is tried again sooner
        cache = cache && cache.catalog.live
          ? { at: Date.now(), catalog: cache.catalog }
          : { at: Date.now() - TTL + RETRY, catalog: unavailableCatalog() };
        return cache.catalog;
      })
      .finally(function () { pending = null; });
  }
  return pending;
}

export function getCatalog(): Promise<Catalog> {
  if (!cache) return refresh();
  if (Date.now() - cache.at >= TTL) refresh();
  return Promise.resolve(cache.catalog);
}

// "AED 8,000" for a tier's day package, for server components.
export function priceText(catalog: Catalog, tierId: string, pkgId: string): string {
  const t = catalog.tickets[tierId + '/' + pkgId];
  if (!catalog.live) return 'Price unavailable';
  return t && t.price !== null ? money(t.price, catalog.currency) : 'Not available';
}
