import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alfredMock, PAYMENT_URL, TICKET_IDS } from './alfred-mock';

const BUYER = {
  firstName: 'Test', lastName: 'Buyer', email: 'Test@Example.com', repeatEmail: 'test@example.com',
  address: 'Mall Road 1', zipcode: '54000', city: 'Lahore', country: 'PK', gender: 'male',
  birthday: '1990-01-01', phoneCode: 'PK', phone: '300 123-4567', gateway: 'multisafepay', method: '706',
  sms: false, terms: true
};

// app/api/checkout uses lib/catalog, which keeps its answer: a fresh copy for every test
async function checkout(buyer: Record<string, unknown> = {}, items: unknown[] = [{ id: 'ruby-red/fri-sat', quantity: 2 }]) {
  vi.resetModules();
  const { POST } = await import('@/app/api/checkout/route');
  const res = await POST(new Request('http://site.test/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ items, buyer: { ...BUYER, ...buyer } })
  }));
  return { status: res.status, body: await res.json() };
}

beforeEach(function () { vi.spyOn(console, 'error').mockImplementation(function () {}); });
afterEach(function () { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('checkout', function () {
  it('books the order in Alfred and returns the payment page', async function () {
    const alfred = alfredMock();
    const res = await checkout();

    expect(res).toEqual({ status: 200, body: { url: 'https://testpayv2.multisafepay.com/pay' } });
    expect(Object.fromEntries(alfred.sent('Api/Eventsnew/buyTickets')!)).toEqual({
      name: 'Test', surname: 'Buyer', email: 'test@example.com',
      address: 'Mall Road 1', zipcode: '54000', city: 'Lahore', country: 'pakistan',
      gender: 'male', age: '1990-01-01', countryPhoneCode: '92', phoneNumber: '3001234567',
      paymentTypeId: '706', paymentEngine: 'multisafe pay',
      'tickets[0][ticketId]': TICKET_IDS['Ruby Red, Friday & Saturday'], 'tickets[0][quantity]': '2'
    });
  });

  it('sends several tickets and the SMS option', async function () {
    const alfred = alfredMock();
    await checkout({ sms: true }, [{ id: 'ruby-red/3-days', quantity: 1 }, { id: 'ultra-black/sat-sun', quantity: 3 }]);
    const sent = alfred.sent('Api/Eventsnew/buyTickets')!;

    expect(sent.get('sendTicketWithSms')).toBe('on');
    expect(sent.get('tickets[0][ticketId]')).toBe(TICKET_IDS['Ruby Red, 3 days']);
    expect(sent.get('tickets[1][ticketId]')).toBe(TICKET_IDS['Ultra Black, Saturday & Sunday']);
    expect(sent.get('tickets[1][quantity]')).toBe('3');
  });

  it('uses the suggested method when the buyer chose none', async function () {
    const alfred = alfredMock();
    await checkout({ country: 'NL', phoneCode: 'NL', gateway: 'paynl', method: '' });
    expect(alfred.sent('Api/Eventsnew/buyTickets')!.get('paymentTypeId')).toBe('10');
  });

  it('refuses a method the gateway does not offer', async function () {
    const alfred = alfredMock();
    const res = await checkout({ gateway: 'noon', method: '138' });
    expect(res).toEqual({ status: 400, body: { error: 'Please choose how you want to pay.' } });
    expect(alfred.count('Api/Eventsnew/buyTickets')).toBe(0);
  });

  it.each([
    [{ firstName: '' }, 'Please fill in all fields.'],
    [{ firstName: 'R2D2' }, 'Please use letters only in your name.'],
    [{ zipcode: '!' }, 'Please enter a valid zip code.'],
    [{ email: 'no-at-sign', repeatEmail: 'no-at-sign' }, 'Please enter a valid email address.'],
    [{ repeatEmail: 'other@example.com' }, 'The email addresses don’t match.'],
    [{ country: 'XX' }, 'Please select your country.'],
    [{ gender: 'robot' }, 'Please select your gender.'],
    [{ birthday: '1990-02-31' }, 'Please enter a valid birthday.'],
    [{ phone: '12' }, 'Please enter a valid phone number.'],
    [{ gateway: 'stripe' }, 'Please choose a payment method.'],
    [{ terms: false }, 'Please agree to the terms and conditions.']
  ])('refuses %o: %s', async function (buyer, error) {
    const alfred = alfredMock();
    expect(await checkout(buyer)).toEqual({ status: 400, body: { error } });
    expect(alfred.count('Api/Eventsnew/buyTickets')).toBe(0);
  });

  it.each([
    [[], 'Your order is empty.'],
    [[{ id: 'gold/3-days', quantity: 1 }], 'Your order has a ticket that isn’t available. Please review your tickets.'],
    [[{ id: 'ruby-red/3-days', quantity: 11 }], 'Your order has a ticket that isn’t available. Please review your tickets.'],
    [[{ id: 'ruby-red/3-days', quantity: 1.5 }], 'Your order has a ticket that isn’t available. Please review your tickets.']
  ])('refuses the items %j', async function (items, error) {
    alfredMock();
    expect(await checkout({}, items)).toEqual({ status: 400, body: { error } });
  });

  it('refuses a ticket sold out in Alfred', async function () {
    alfredMock({ 'Api/Eventsnew/Ticketsoldout': function () { return { left_tickets: 0 }; } });
    const res = await checkout();
    expect(res.body.error).toBe('Your order has a ticket that isn’t available. Please review your tickets.');
  });

  it('takes no order while Alfred\'s prices can\'t be loaded', async function () {
    const alfred = alfredMock({ 'Api/Eventsnew/VendorEvents': null });
    const res = await checkout();
    expect(res).toEqual({ status: 400, body: { error: 'Ticket prices can’t be loaded right now. You have not been charged. Please try again in a moment.' } });
    expect(alfred.count('Api/Eventsnew/buyTickets')).toBe(0);
  });

  it('passes on Alfred\'s message when it refuses the order', async function () {
    alfredMock({ 'Api/Eventsnew/buyTickets': function () { return { status: '0', message: 'You have reached the maximum bookings for this ticket!' }; } });
    expect((await checkout()).body.error).toBe('You have reached the maximum bookings for this ticket!');
  });

  it('follows Alfred\'s redirects to the provider', async function () {
    alfredMock({}, {
      [PAYMENT_URL]: { status: 302, location: '/noon_payment/KEY' },
      'http://alfred.test/noon_payment/KEY': { status: 302, location: 'https://pay.noonpayments.com/en/default/index?info=x' }
    });
    const res = await checkout({ country: 'AE', phoneCode: 'AE', phone: '501234567', gateway: 'noon' });
    expect(res.body).toEqual({ url: 'https://pay.noonpayments.com/en/default/index?info=x' });
  });

  it('tells the buyer on the form when the gateway refuses the payment', async function () {
    alfredMock({}, { [PAYMENT_URL]: { status: 302, location: 'http://alfred.test/ticketing_denied?orderid=1' } });
    const res = await checkout();
    expect(res).toEqual({
      status: 400,
      body: { error: 'MultiSafepay isn’t available for your order right now. You have not been charged. Please choose another payment method or try again later.' }
    });
  });

  it('gives a general error when Alfred fails', async function () {
    alfredMock({ 'Api/Eventsnew/buyTickets': null });
    expect(await checkout()).toEqual({ status: 502, body: { error: 'We couldn’t start the payment. Please try again in a moment.' } });
  });
});
