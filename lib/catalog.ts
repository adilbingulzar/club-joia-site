/*
 * Prices, currency and sold out of the tickets, from Alfred (server only):
 * the event's tickets (Api/Eventsnew/Tickettypes, matched by name, "Ruby Red, 3 days"),
 * how many are left of each (Ticketsoldout) and the event's currency (VendorEvents).
 * Pages get the last answer at once and a newer one is fetched behind it when it is over a
 * minute old, so only the first page after a start waits for Alfred. When Alfred can't be
 * reached the last answer stays, else the catalogue is unavailable (no prices, no ordering).
 */
import { CJ_CONFIG as cfg, unavailableCatalog, money, type Catalog } from './config';
import { ALFRED_URL, EVENT_ID, VENDOR_ID, alfred } from './alfred';

const TTL = 60 * 1000;
const RETRY = 10 * 1000; // after a failed load without an answer to show
const TIMEOUT = 8000;

// Alfred's event currencies ("euro", "aed", ...) as ISO codes.
const CURRENCIES: Record<string, string> = { euro: 'EUR', usd: 'USD', aed: 'AED', mad: 'MAD', gbp: 'GBP' };

let cache: { at: number; catalog: Catalog } | null = null;
let pending: Promise<Catalog> | null = null;

async function load(): Promise<Catalog> {
  if (!ALFRED_URL || !EVENT_ID || !VENDOR_ID) throw new Error('ALFRED_URL, ALFRED_EVENT_ID and ALFRED_VENDOR_ID must be set');

  const [types, events] = await Promise.all([
    alfred('Api/Eventsnew/Tickettypes', { eventId: EVENT_ID, ticketType: '0' }, TIMEOUT),
    alfred('Api/Eventsnew/VendorEvents', { vendorId: VENDOR_ID }, TIMEOUT)
  ]);
  const event = (Array.isArray(events) ? events : []).filter(function (e) { return String(e && e.id) === EVENT_ID; })[0];
  const currency = event && CURRENCIES[event.eventCurrency];
  if (!currency) throw new Error('Alfred event ' + EVENT_ID + ' not found for vendor ' + VENDOR_ID + ' or has no currency');

  const byName: Record<string, { id: string; ticketPrice: string }> = {};
  (Array.isArray(types) ? types : []).forEach(function (t) {
    if (t && t.softDelete === '0' && t.ticketVisible === '1') byName[String(t.ticketDescription).trim()] = t;
  });

  const tickets: Catalog['tickets'] = {};
  await Promise.all(cfg.tickets.map(async function (t) {
    const a = byName[t.name];
    // not on sale in Alfred
    if (!a) { tickets[t.id] = { price: null, soldOut: true }; return; }
    const left = await alfred('Api/Eventsnew/Ticketsoldout', { ticketId: String(a.id) }, TIMEOUT);
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
