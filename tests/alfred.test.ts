import { afterEach, describe, expect, it, vi } from 'vitest';
import { paymentMethods, suggestedMethod } from '@/lib/alfred';
import { alfredMock } from './alfred-mock';

afterEach(function () { vi.unstubAllGlobals(); });

const methods = [
  { id: '10', alfredName: 'ideal payment' },
  { id: '706', alfredName: 'credit card payment' },
  { id: '436', alfredName: 'bancontact payment' }
];

describe('suggestedMethod', function () {
  it('suggests iDEAL in the Netherlands and Bancontact in Belgium on Pay.nl', function () {
    expect(suggestedMethod(methods, 'NL', 'paynl')).toBe('10');
    expect(suggestedMethod(methods, 'BE', 'paynl')).toBe('436');
  });

  it('suggests a credit card elsewhere and on the other gateways', function () {
    expect(suggestedMethod(methods, 'PK', 'paynl')).toBe('706');
    expect(suggestedMethod(methods, 'NL', 'multisafe pay')).toBe('706');
    expect(suggestedMethod(methods, 'AE', 'noon')).toBe('706');
  });

  it('falls back to the first method, or none', function () {
    expect(suggestedMethod([{ id: '138', alfredName: 'PayPal' }], 'PK', 'paynl')).toBe('138');
    expect(suggestedMethod([], 'PK', 'paynl')).toBe('');
  });
});

describe('paymentMethods', function () {
  it('asks Alfred for the engine of the event and names the methods for the form', async function () {
    const alfred = alfredMock();
    const list = await paymentMethods('paynl');

    expect(list.map(function (m) { return m.name; })).toEqual(['iDEAL', 'Credit card', 'Bancontact', 'MyBank', 'PayPal']);
    expect(list[0]).toEqual({ id: '10', name: 'iDEAL', icon: 'http://alfred.test/ideal.png', alfredName: 'ideal payment' });
    const sent = alfred.sent('Api/Eventsnew/buyTicketsPaymentMethods')!;
    expect(Object.fromEntries(sent)).toEqual({ eventId: '5263', paymentEngine: 'paynl' });
  });

  it('is empty when Alfred has no method', async function () {
    alfredMock({ 'Api/Eventsnew/buyTicketsPaymentMethods': function () { return { status: '0', message: 'No payment method found' }; } });
    expect(await paymentMethods('noon')).toEqual([]);
  });

  it('fails when Alfred does', async function () {
    alfredMock({ 'Api/Eventsnew/buyTicketsPaymentMethods': null });
    await expect(paymentMethods('noon')).rejects.toThrow('HTTP 503');
  });
});
