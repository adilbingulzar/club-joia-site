import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alfredMock, PAYMENT_URL, TICKET_IDS } from './alfred-mock';

const BUYER = {
  firstName: 'Test', lastName: 'Buyer', email: 'Test@Example.com', repeatEmail: 'test@example.com',
  address: 'Mall Road 1', zipcode: '54000', city: 'Lahore', country: 'PK', gender: 'male',
  birthday: '1990-01-01', phoneCode: 'PK', phone: '300 123-4567',
  over21: true, terms: true
};

// app/api/checkout uses lib/catalog, which keeps its answer: a fresh copy for every test
async function checkout(buyer: Record<string, unknown> = {}, items: unknown[] = [{ id: 'ruby-red/fri-sat', quantity: 2 }]) {
  vi.resetModules();
  const { POST } = await import('@/app/api/checkout/route');
  const res = await POST(new Request('http://site.test/api/checkout', {
    method: 'POST',
    // the buyer's address as a proxy in front of the site passes it
    headers: { 'X-Forwarded-For': '203.0.113.7, 10.0.0.1' },
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
      gender: 'male', age: '1990-01-01', countryPhoneCode: '92', phoneNumber: '3001234567', ip: '203.0.113.7',
      'tickets[0][ticketId]': TICKET_IDS['Ruby Red, Friday & Saturday'], 'tickets[0][quantity]': '2'
    });
  });

  it('sends no gender or birthday when they are left empty', async function () {
    const alfred = alfredMock();
    const { status } = await checkout({ gender: '', birthday: '' });
    const sent = alfred.sent('Api/Eventsnew/buyTickets')!;

    expect(status).toBe(200);
    expect(sent.has('gender')).toBe(false);
    expect(sent.has('age')).toBe(false);
  });

  it('sends several tickets, no SMS option', async function () {
    const alfred = alfredMock();
    await checkout({ sms: true }, [{ id: 'ruby-red/3-days', quantity: 1 }, { id: 'ultra-black/fri-sun', quantity: 3 }]);
    const sent = alfred.sent('Api/Eventsnew/buyTickets')!;

    expect(sent.has('sendTicketWithSms')).toBe(false);
    // the ticket API's key, on every call
    alfred.calls.forEach(function (c) { expect(c.auth).toBe('Bearer unit-test-shop-key-0123456789'); });
    expect(sent.get('tickets[0][ticketId]')).toBe(TICKET_IDS['Ruby Red, 3 days']);
    expect(sent.get('tickets[1][ticketId]')).toBe(TICKET_IDS['Ultra Black, Friday & Sunday']);
    expect(sent.get('tickets[1][quantity]')).toBe('3');
  });

  it('leaves the gateway and method to Alfred, whatever the browser sends', async function () {
    const alfred = alfredMock();
    await checkout({ country: 'AE', phoneCode: 'NL', gateway: 'paynl', method: '138' });
    const sent = alfred.sent('Api/Eventsnew/buyTickets')!;
    expect(sent.get('country')).toBe('united arab emirates');
    expect(sent.has('paymentEngine')).toBe(false);
    expect(sent.has('paymentTypeId')).toBe(false);
  });

  // Alfred's table in config/custom.php goes by these names
  it.each([
    ['AE', 'united arab emirates'], ['SA', 'saudi arabia'], ['EG', 'egypt'], ['KW', 'kuwait'], ['OM', 'oman'],
    ['JO', 'jordan'], ['LB', 'lebanon'], ['BH', 'bahrain'], ['QA', 'qatar'],
    ['NL', 'netherlands'], ['BE', 'belgium'], ['AT', 'austria'], ['PL', 'poland'], ['FI', 'finland'], ['DK', 'denmark'],
    ['SE', 'sweden'], ['NO', 'norway'], ['CH', 'switzerland'], ['ES', 'spain'], ['IT', 'italy'], ['PT', 'portugal']
  ])('sends %s as %s', async function (code, name) {
    const alfred = alfredMock();
    await checkout({ country: code });
    expect(alfred.sent('Api/Eventsnew/buyTickets')!.get('country')).toBe(name);
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
    [{ birthday: String(new Date().getFullYear() - 18) + '-01-01' }, 'You must be older than 21 to buy tickets.'],
    [{ phone: '12' }, 'Please enter a valid phone number.'],
    [{ over21: false }, 'Please confirm that you are older than 21.'],
    [{ terms: false }, 'Please agree to the terms and conditions.']
  ])('refuses %o: %s', async function (buyer, error) {
    const alfred = alfredMock();
    expect(await checkout(buyer)).toEqual({ status: 400, body: { error } });
    expect(alfred.count('Api/Eventsnew/buyTickets')).toBe(0);
  });

  it.each([
    [[], 'Your order is empty.'],
    [[{ id: 'gold/3-days', quantity: 1 }], 'Your order has a ticket that isn’t available. Please review your tickets.'],
    [[{ id: 'ruby-red/sat-sun', quantity: 1 }], 'Your order has a ticket that isn’t available. Please review your tickets.'],
    [[{ id: 'ruby-red/3-days', quantity: 11 }], 'Your order has a ticket that isn’t available. Please review your tickets.'],
    [[{ id: 'ruby-red/3-days', quantity: 1.5 }], 'Your order has a ticket that isn’t available. Please review your tickets.']
  ])('refuses the items %j', async function (items, error) {
    alfredMock();
    expect(await checkout({}, items)).toEqual({ status: 400, body: { error } });
  });

  it('refuses a ticket sold out in Alfred', async function () {
    alfredMock({ 'Api/Eventsnew/buyTicketsSoldOut': function () { return { left_tickets: 0 }; } });
    const res = await checkout();
    expect(res.body.error).toBe('Your order has a ticket that isn’t available. Please review your tickets.');
  });

  it('takes no order while Alfred\'s prices can\'t be loaded', async function () {
    const alfred = alfredMock({ 'Api/Eventsnew/buyTicketsEvents': null });
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
    const res = await checkout({ country: 'AE', phoneCode: 'AE', phone: '501234567' });
    expect(res.body).toEqual({ url: 'https://pay.noonpayments.com/en/default/index?info=x' });
  });

  it('follows the redirects of the server that made the link, behind ALFRED_URL', async function () {
    const uae = 'http://uae.test/booking/onlinepayment/706/0?order=KEY';
    alfredMock({ 'Api/Eventsnew/buyTickets': function () { return { status: '1', paymentUrl: uae }; } }, {
      [uae]: { status: 302, location: 'http://uae.test/noon_payment/KEY' },
      'http://uae.test/noon_payment/KEY': { status: 302, location: 'https://pay.noonpayments.com/en/default/index?info=x' }
    });
    const res = await checkout({ country: 'AE', phoneCode: 'AE', phone: '501234567' });
    expect(res.body).toEqual({ url: 'https://pay.noonpayments.com/en/default/index?info=x' });
  });

  it('reports a denied payment on the server that made the link', async function () {
    const uae = 'http://uae.test/booking/onlinepayment/706/0?order=KEY';
    alfredMock({ 'Api/Eventsnew/buyTickets': function () { return { status: '1', paymentUrl: uae }; } }, {
      [uae]: { status: 302, location: 'http://uae.test/ticketing_denied?orderid=1' }
    });
    expect((await checkout()).status).toBe(400);
  });

  it('tells the buyer on the form when the gateway refuses the payment', async function () {
    alfredMock({}, { [PAYMENT_URL]: { status: 302, location: 'http://alfred.test/ticketing_denied?orderid=1' } });
    const res = await checkout();
    expect(res).toEqual({
      status: 400,
      body: { error: 'Payment isn’t available for your order right now. You have not been charged. Please try again later.' }
    });
  });

  it('gives a general error when Alfred fails', async function () {
    alfredMock({ 'Api/Eventsnew/buyTickets': null });
    expect(await checkout()).toEqual({ status: 502, body: { error: 'We couldn’t start the payment. Please try again in a moment.' } });
  });
});
