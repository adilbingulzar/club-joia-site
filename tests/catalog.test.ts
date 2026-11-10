import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CJ_CONFIG as cfg } from '@/lib/config';
import { shopMock, TICKET_IDS } from './shop-mock';

// lib/catalog keeps its answer in the module: a fresh copy for every test
async function catalogModule() {
  vi.resetModules();
  return import('@/lib/catalog');
}

beforeEach(function () {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(function () {});
});

afterEach(function () {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getCatalog', function () {
  it('takes prices, currency and stock from the shop', async function () {
    shopMock();
    const { getCatalog, priceText } = await catalogModule();
    const c = await getCatalog();

    expect(c.live).toBe(true);
    expect(c.currency).toBe('AED');
    expect(Object.keys(c.tickets)).toHaveLength(cfg.tickets.length);
    expect(c.tickets['ruby-red/3-days']).toEqual({ price: 8000, soldOut: false });
    expect(priceText(c, 'ruby-red', '3-days')).toBe('AED 8,000');
  });

  it('writes the event currencies as ISO codes', async function () {
    shopMock({ 'events': function () { return [{ id: 'abu-dhabi-2026', eventCurrency: 'euro' }]; } });
    const { getCatalog } = await catalogModule();
    expect((await getCatalog()).currency).toBe('EUR');
  });

  it('shows a ticket with none left as sold out', async function () {
    const soldOutId = TICKET_IDS['Ultra Black, 3 days'];
    shopMock({
      'soldOut': function (d) { return { left_tickets: d.get('ticketId') === soldOutId ? 0 : 5 }; }
    });
    const { getCatalog } = await catalogModule();
    const c = await getCatalog();

    expect(c.tickets['ultra-black/3-days'].soldOut).toBe(true);
    expect(c.tickets['ruby-red/3-days'].soldOut).toBe(false);
  });

  it('shows a ticket that is hidden or deleted in the shop as not available', async function () {
    shopMock({
      'ticketTypes': function () {
        return cfg.tickets.map(function (t) {
          return { id: TICKET_IDS[t.name], ticketDescription: t.name, ticketPrice: '100.00', softDelete: t.id === 'pearly-white/fri-sun' ? '1' : '0', ticketVisible: '1' };
        });
      }
    });
    const { getCatalog, priceText } = await catalogModule();
    const c = await getCatalog();

    expect(c.tickets['pearly-white/fri-sun']).toEqual({ price: null, soldOut: true });
    expect(priceText(c, 'pearly-white', 'fri-sun')).toBe('Not available');
  });

  it('is unavailable, never config prices, when the shop fails before its first answer', async function () {
    const shop = shopMock({ 'events': null });
    const { getCatalog, priceText } = await catalogModule();
    const c = await getCatalog();

    expect(c.live).toBe(false);
    expect(c.tickets).toEqual({});
    expect(priceText(c, 'ruby-red', '3-days')).toBe('Price unavailable');

    // tried again after 10 seconds, not on every page
    await getCatalog();
    expect(shop.count('events')).toBe(1);
    vi.setSystemTime(new Date('2026-10-29T12:00:11Z'));
    await getCatalog();
    expect(shop.count('events')).toBe(2);
  });

  it('is unavailable when the event is not on sale', async function () {
    shopMock({ 'events': function () { return [{ id: '1', eventCurrency: 'aed' }]; } });
    const { getCatalog } = await catalogModule();
    expect((await getCatalog()).live).toBe(false);
  });

  it('answers from memory for a minute, then at once with the old answer while it fetches a new one', async function () {
    let currency = 'aed';
    const shop = shopMock({ 'events': function () { return [{ id: 'abu-dhabi-2026', eventCurrency: currency }]; } });
    const { getCatalog } = await catalogModule();

    expect((await getCatalog()).currency).toBe('AED');
    vi.setSystemTime(new Date('2026-10-29T12:00:59Z'));
    await getCatalog();
    expect(shop.count('events')).toBe(1);

    currency = 'usd';
    vi.setSystemTime(new Date('2026-10-29T12:01:01Z'));
    expect((await getCatalog()).currency).toBe('AED'); // no waiting for the shop
    await vi.waitFor(async function () { expect((await getCatalog()).currency).toBe('USD'); });
    expect(shop.count('events')).toBe(2);
  });

  it('keeps the last answer when the shop fails later', async function () {
    let up = true;
    shopMock({ 'events': function () { if (!up) throw new Error('down'); return [{ id: 'abu-dhabi-2026', eventCurrency: 'aed' }]; } });
    const { getCatalog } = await catalogModule();

    expect((await getCatalog()).live).toBe(true);
    up = false;
    vi.setSystemTime(new Date('2026-10-29T12:02:00Z'));
    await getCatalog();
    await vi.waitFor(function () { expect(console.error).toHaveBeenCalled(); });
    const c = await getCatalog();
    expect(c.live).toBe(true);
    expect(c.currency).toBe('AED');
  });
});
