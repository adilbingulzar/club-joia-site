import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/checkout/methods/route';
import { alfredMock } from './alfred-mock';

async function methods(query: string) {
  const res = await GET(new Request('http://site.test/api/checkout/methods?' + query));
  return { status: res.status, body: await res.json() };
}

afterEach(function () { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('payment methods for the form', function () {
  it('lists the gateway\'s methods with their icons and the suggested one', async function () {
    alfredMock();
    const res = await methods('gateway=paynl&country=NL');

    expect(res.status).toBe(200);
    expect(res.body.suggested).toBe('10');
    expect(res.body.methods[0]).toEqual({ id: '10', name: 'iDEAL', icon: 'http://alfred.test/ideal.png' });
    expect(res.body.methods.map(function (m: { name: string }) { return m.name; })).toEqual(['iDEAL', 'Credit card', 'Bancontact', 'MyBank', 'PayPal']);
  });

  it('only has a credit card on noon', async function () {
    alfredMock();
    const res = await methods('gateway=noon&country=AE');
    expect(res.body).toEqual({ methods: [{ id: '706', name: 'Credit card', icon: 'http://alfred.test/creditcard.png' }], suggested: '706' });
  });

  it.each(['gateway=stripe&country=NL', 'gateway=paynl&country=XX', 'gateway=paynl', ''])('refuses %s', async function (query) {
    alfredMock();
    expect((await methods(query)).status).toBe(400);
  });

  it('fails when Alfred does', async function () {
    vi.spyOn(console, 'error').mockImplementation(function () {});
    alfredMock({ 'Api/Eventsnew/buyTicketsPaymentMethods': null });
    expect(await methods('gateway=noon&country=AE')).toEqual({ status: 502, body: { error: 'We couldn’t load the payment options.' } });
  });
});
