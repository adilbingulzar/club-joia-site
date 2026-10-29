/*
 * A fake Alfred for the tests: answers the site's POSTs to http://alfred.test/<path> and the
 * GETs that follow a payment link. Every answer can be replaced; null makes Alfred fail (503).
 */
import { vi } from 'vitest';
import { CJ_CONFIG as cfg } from '@/lib/config';

type Answer = (data: URLSearchParams) => unknown;
type Page = { status: number; location?: string };

// Alfred ticket ids by ticket name, as in the local database (21525 ...)
export const TICKET_IDS: Record<string, string> = {};
cfg.tickets.forEach(function (t, i) { TICKET_IDS[t.name] = String(21525 + i); });

export const METHODS: Record<string, { paymentTypeId: string; paymentMethod: string; paymentMethodIcon: string }[]> = {
  noon: [{ paymentTypeId: '706', paymentMethod: 'credit card payment', paymentMethodIcon: 'http://alfred.test/creditcard.png' }],
  'multisafe pay': [
    { paymentTypeId: '10', paymentMethod: 'ideal payment', paymentMethodIcon: 'http://alfred.test/ideal.png' },
    { paymentTypeId: '706', paymentMethod: 'credit card payment', paymentMethodIcon: 'http://alfred.test/creditcard.png' },
    { paymentTypeId: '436', paymentMethod: 'bancontact payment', paymentMethodIcon: 'http://alfred.test/bancontact.png' }
  ],
  paynl: [
    { paymentTypeId: '10', paymentMethod: 'ideal payment', paymentMethodIcon: 'http://alfred.test/ideal.png' },
    { paymentTypeId: '706', paymentMethod: 'credit card payment', paymentMethodIcon: 'http://alfred.test/creditcard.png' },
    { paymentTypeId: '436', paymentMethod: 'bancontact payment', paymentMethodIcon: 'http://alfred.test/bancontact.png' },
    { paymentTypeId: '559', paymentMethod: 'my bank', paymentMethodIcon: '' },
    { paymentTypeId: '138', paymentMethod: 'PayPal', paymentMethodIcon: 'https://static.pay.nl/21.png' }
  ]
};

export const PAYMENT_URL = 'http://alfred.test/booking/onlinepayment/706/0?order=KEY';

export function alfredMock(answers: Record<string, Answer | null> = {}, pages: Record<string, Page> = {}) {
  const calls: { path: string; data: URLSearchParams }[] = [];
  const all: Record<string, Answer | null> = {
    'Api/Eventsnew/Tickettypes': function () {
      return cfg.tickets.map(function (t) {
        return { id: TICKET_IDS[t.name], ticketDescription: t.name, ticketPrice: t.price + '.00', softDelete: '0', ticketVisible: '1' };
      });
    },
    'Api/Eventsnew/VendorEvents': function () { return [{ id: '5263', eventCurrency: 'aed' }]; },
    'Api/Eventsnew/Ticketsoldout': function () { return { left_tickets: 100 }; },
    'Api/Eventsnew/buyTicketsPaymentMethods': function (d) {
      return { status: '1', paymentMethods: METHODS[d.get('paymentEngine') || ''] || [] };
    },
    'Api/Eventsnew/buyTickets': function () { return { status: '1', paymentUrl: PAYMENT_URL }; },
    ...answers
  };

  const fetchMock = vi.fn(async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (init && init.method === 'POST') {
      const path = url.replace('http://alfred.test/', '');
      const data = new URLSearchParams(String(init.body));
      calls.push({ path, data });
      const answer = all[path];
      return answer ? Response.json(answer(data)) : new Response('', { status: 503 });
    }
    // a payment link: by default Alfred sends the buyer on to MultiSafepay
    const page = pages[url] || { status: 302, location: 'https://testpayv2.multisafepay.com/pay' };
    return new Response(null, { status: page.status, headers: page.location ? { location: page.location } : {} });
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    // the data of the last call to an Alfred path
    sent: function (path: string): URLSearchParams | undefined {
      return calls.filter(function (c) { return c.path === path; }).pop()?.data;
    },
    count: function (path: string): number {
      return calls.filter(function (c) { return c.path === path; }).length;
    }
  };
}
