/*
 * A stand-in for the ticket shop's functions the site calls (lib/shop/orders): events,
 * ticketTypes, soldOut, buyTickets, preparePayment. Every answer can be replaced; null makes the call fail.
 * Use before the module under test is imported (vi.resetModules, then import).
 */
import { vi } from 'vitest';
import { CJ_CONFIG as cfg } from '@/lib/config';

type Answer = (data: URLSearchParams) => unknown;

// the shop's ticket ids by ticket name
export const TICKET_IDS: Record<string, string> = {};
cfg.tickets.forEach(function (t) { TICKET_IDS[t.name] = t.id; });

export const EVENT = 'abu-dhabi-2026';
// the site's payment page of the order the mock books
export const PAY_PAGE = 'http://site.test/pay/CJTEST';

export function shopMock(answers: Record<string, Answer | null> = {}) {
  const calls: { name: string; data: URLSearchParams }[] = [];
  const all: Record<string, Answer | null> = {
    events: function () { return [{ id: EVENT, eventCurrency: 'aed' }]; },
    ticketTypes: function () {
      return cfg.tickets.map(function (t) {
        return { id: TICKET_IDS[t.name], ticketDescription: t.name, ticketPrice: t.price + '.00', softDelete: '0', ticketVisible: '1' };
      });
    },
    soldOut: function () { return { left_tickets: 100 }; },
    buyTickets: function () { return { status: '1', paymentUrl: 'http://site.test/shop/pay/CJTEST', orderId: 'CJTEST' }; },
    preparePayment: function () { return { state: 'ready', ref: 'CJTEST', amount: 8000, currency: 'USD', items: [], init: { store_id: 1, currency: 'USD', test_mode: 1 } }; },
    ...answers
  };
  const fn = function (name: string, toData: (...a: never[]) => Record<string, string>) {
    return async function (...a: never[]) {
      const data = new URLSearchParams(toData(...a));
      calls.push({ name, data });
      const answer = all[name];
      if (!answer) throw new Error('shop ' + name + ' failed');
      return answer(data);
    };
  };
  vi.doMock('@/lib/shop/orders', function () {
    return {
      events: fn('events', function () { return {}; }),
      ticketTypes: fn('ticketTypes', function (eventId: string) { return { eventId }; }),
      soldOut: fn('soldOut', function (ticketId: string) { return { ticketId }; }),
      buyTickets: fn('buyTickets', function (form: Record<string, string>) { return form; }),
      preparePayment: fn('preparePayment', function (ref: string) { return { ref }; })
    };
  });

  return {
    calls,
    // the data of the last call to a function
    sent: function (name: string): URLSearchParams | undefined {
      return calls.filter(function (c) { return c.name === name; }).pop()?.data;
    },
    count: function (name: string): number {
      return calls.filter(function (c) { return c.name === name; }).length;
    }
  };
}
