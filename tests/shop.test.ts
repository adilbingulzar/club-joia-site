/*
 * End-to-end test of the ticket shop's APIs (app/Api/Eventsnew, app/shop) on a real database with a
 * stand-in Telr: the site's calls, Telr's return and advice, the member and tickets made, the
 * emails, retry, and the sales dashboard's API. Removes what it made.
 *
 * Needs a local or test copy of the members app's MySQL database (never the live one), with the
 * event, its tiers and ticket types, and the demo staff accounts (the members app's seed):
 *   SHOP_TEST_DATABASE_URL=mysql://user:password@host:3306/database npx vitest run tests/shop.test.ts
 * Skipped without it. With the site's limited user in SHOP_TEST_DATABASE_URL,
 * SHOP_TEST_ADMIN_DATABASE_URL is the owner's, for the test's own checks and clean-up.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const DB_URL = process.env.SHOP_TEST_DATABASE_URL || '';
const CHECK_URL = process.env.SHOP_TEST_ADMIN_DATABASE_URL || DB_URL;
const SITE = 'http://site.test';
const EVENT = process.env.SHOP_TEST_EVENT || 'abu-dhabi-2026';
const ADMIN_KEY = 'shop-test-admin-key-0123456789';
const email = 'shoptest+' + Date.now() + '@example.com';

// ─── Stand-in Telr: create and check, POST /control sets what a check answers for a cart ───
const telrOrders: Record<string, { cartid: string; amount: string; currency: string; test: string }> = {};
const answers: Record<string, { code: number; amount?: string; currency?: string; test?: number }> = {};
let creates = 0;
let stub: http.Server;

function startStub(): Promise<string> {
  stub = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      const p = body ? JSON.parse(body) : {};
      const send = function (o: unknown) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (!p.store || !p.authkey) return send({ method: p.method, error: { message: 'E01 store/authkey missing' } });
      if (p.method === 'create') {
        if (Object.values(telrOrders).some(function (o) { return o.cartid === p.order.cartid; })) return send({ method: 'create', error: { message: 'E56 duplicate cartid' } });
        creates++;
        const ref = 'STUBREF' + creates;
        telrOrders[ref] = { cartid: p.order.cartid, amount: p.order.amount, currency: p.order.currency, test: p.order.test };
        return send({ method: 'create', order: { ref, url: 'https://secure.telr.example/gateway/process.html?o=' + ref } });
      }
      if (p.method === 'check') {
        const o = telrOrders[p.order.ref];
        if (!o) return send({ method: 'check', error: { message: 'E05 order not found' } });
        const a = answers[o.cartid] || { code: 1 };
        return send({ method: 'check', order: { ref: p.order.ref, cartid: o.cartid, test: a.test !== undefined ? a.test : Number(o.test), amount: a.amount || o.amount, currency: a.currency || o.currency, status: { code: a.code, text: 'stub' } } });
      }
      send({ error: { message: 'unknown method' } });
    });
  });
  return new Promise(function (resolve) {
    stub.listen(0, '127.0.0.1', function () { resolve('http://127.0.0.1:' + (stub.address() as AddressInfo).port + '/gateway/order.json'); });
  });
}

// ─── The route handlers, called as Next calls them ───
type Ctx<P> = { params: Promise<P> };
let routes: {
  api: { POST: (r: Request, c: Ctx<{ name: string }>) => Promise<Response> };
  pay: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  ret: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  advice: { POST: (r: Request) => Promise<Response> };
  retry: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  admin: { GET: (r: Request, c: Ctx<{ path: string[] }>) => Promise<Response>; POST: (r: Request, c: Ctx<{ path: string[] }>) => Promise<Response> };
  prereg: { POST: (r: Request) => Promise<Response> };
};
let closeDb: () => Promise<void>;
// the test's own connection (the owner's), queries written as the shop's (lib/shop/db.ts)
let raw: mysql.Pool;
let toMysql: (text: string, params?: unknown[]) => [string, unknown[]];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pool = { query: async function (text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
  const [r] = await raw.query(...toMysql(text, params));
  return { rows: Array.isArray(r) ? r : [] };
} };
const mails: string[] = [];

async function api(name: string, form: Record<string, string>, key = ADMIN_KEY) {
  const headers = key ? { Authorization: 'Bearer ' + key } : undefined;
  const r = await routes.api.POST(new Request(SITE + '/Api/Eventsnew/' + name, { method: 'POST', headers, body: new URLSearchParams(form) }), { params: Promise.resolve({ name }) });
  const text = await r.text();
  return { status: r.status, body: /json/.test(r.headers.get('content-type') || '') ? JSON.parse(text) : text };
}

// a GET of a /shop/... link: { status, location }
async function get(url: string) {
  const path = new URL(url).pathname.split('/').map(decodeURIComponent);
  const req = new Request(url);
  let r: Response;
  if (path[2] === 'pay') r = await routes.pay.GET(req, { params: Promise.resolve({ ref: path[3] }) });
  else if (path[2] === 'telr' && path[3] === 'return') r = await routes.ret.GET(req, { params: Promise.resolve({ ref: path[4] }) });
  else if (path[2] === 'retry') r = await routes.retry.GET(req, { params: Promise.resolve({ ref: path[3] }) });
  else throw new Error('no route for ' + url);
  return { status: r.status, location: r.headers.get('location') };
}

function buyer(extra: Record<string, string> = {}) {
  return Object.assign({
    name: 'Shop', surname: 'Tester', email, address: 'Street 1', zipcode: '12345', city: 'Lahore',
    country: 'pakistan', countryPhoneCode: '+92', phoneNumber: '3001234567'
  }, extra);
}

function order(lines: [string, number][]) {
  const form: Record<string, string> = buyer();
  lines.forEach(function (l, i) { form['tickets[' + i + '][ticketId]'] = l[0]; form['tickets[' + i + '][quantity]'] = String(l[1]); });
  return api('buyTickets', form);
}

function refOf(paymentUrl: string): string {
  return decodeURIComponent(paymentUrl.split('/shop/pay/')[1]);
}

// the site's DB_* settings from a mysql:// address
function dbEnv(address: string) {
  const u = new URL(address);
  return {
    DB_HOST: u.hostname, DB_PORT: u.port || '3306', DB_USER: decodeURIComponent(u.username),
    DB_PASSWORD: decodeURIComponent(u.password), DB_NAME: decodeURIComponent(u.pathname.slice(1))
  };
}

const one = function (sql: string, params: unknown[] = []) { return pool.query(sql, params).then(function (r) { return r.rows[0]; }); };

describe.skipIf(!DB_URL)('ticket shop on a database', function () {
  beforeAll(async function () {
    Object.assign(process.env, {
      ...dbEnv(DB_URL), SHOP_EVENT: EVENT, SHOP_CURRENCY: 'USD', SHOP_SITE_URL: SITE, SHOP_PUBLIC_URL: '',
      SHOP_ADMIN_KEY: ADMIN_KEY, TELR_STORE_ID: '1', TELR_AUTH_KEY: 'test', TELR_TEST: '1', TELR_URL: await startStub(),
      EMAIL_DRIVER: 'console', SHOP_SUPPORT_PHONE: '+971 50 000 0000', PREREG_NOTIFY_EMAIL: 'team@example.com', PREREG_SEND_CONFIRMATION: '1'
    });
    vi.spyOn(console, 'info').mockImplementation(function (...a: unknown[]) { mails.push(a.join(' ')); });
    vi.spyOn(console, 'error').mockImplementation(function () {});
    raw = mysql.createPool({ uri: CHECK_URL, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 2 });
    toMysql = (await import('@/lib/shop/db')).toMysql;
    routes = {
      api: await import('@/app/Api/Eventsnew/[name]/route'),
      pay: await import('@/app/shop/pay/[ref]/route'),
      ret: await import('@/app/shop/telr/return/[ref]/route'),
      advice: await import('@/app/shop/telr/advice/route'),
      retry: await import('@/app/shop/retry/[ref]/route'),
      admin: await import('@/app/shop/admin/[...path]/route'),
      prereg: await import('@/app/api/preregister/route')
    };
    closeDb = (await import('@/lib/shop/db')).closeDb;
  });

  afterAll(async function () {
    await cleanup().catch(function (e) { process.stderr.write('cleanup: ' + e + '\n'); });
    await closeDb();
    await raw.end();
    await new Promise(function (r) { stub.close(r); });
    vi.restoreAllMocks();
  });

  // shared across the steps, in order
  let ref1 = '', ref2 = '', ref3 = '', ref3b = '', ref4 = '';
  let memberId = '';

  it('answers the site\'s calls', async function () {
    const events = (await api('buyTicketsEvents', { vendorId: '40' })).body;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: EVENT, eventCurrency: 'usd' });
    const dates = await one("SELECT start_date AS s FROM events WHERE slug = $1", [EVENT]);
    expect(events[0].StartDate).toBe(dates.s);

    const types = (await api('buyTicketsTicketTypes', { eventId: EVENT, ticketType: '0' })).body;
    expect(types).toHaveLength(12);
    expect(types.find(function (t: { ticketDescription: string }) { return t.ticketDescription === 'Ruby Red, 3 days'; }))
      .toMatchObject({ id: 'ruby-red/3-days', ticketPrice: '8000.00', softDelete: '0', ticketVisible: '1' });
    expect((await api('buyTicketsTicketTypes', { eventId: 'nope' })).body).toEqual([]);
    expect((await api('buyTicketsSoldOut', { ticketId: 'ruby-red/3-days' })).body.left_tickets).toBeGreaterThan(0);
    expect((await api('nope', {})).status).toBe(404);
  });

  it('answers only this site\'s server (the key)', async function () {
    expect((await api('buyTicketsEvents', { vendorId: '40' }, '')).status).toBe(401);
    expect((await api('buyTickets', buyer({ 'tickets[0][ticketId]': 'ruby-red/3-days', 'tickets[0][quantity]': '1' }), 'wrong-key-wrong-key-wrong')).status).toBe(401);
  });

  it('refuses bad orders', async function () {
    expect((await api('buyTickets', buyer())).body).toEqual({ status: '0', message: 'Your order is empty.' });
    expect((await api('buyTickets', Object.assign(buyer({ email: 'x' }), { 'tickets[0][ticketId]': 'ruby-red/3-days', 'tickets[0][quantity]': '1' }))).body.message).toBe('Please enter a valid email address.');
    expect((await order([['gold/3-days', 1]])).body.status).toBe('0');
    expect((await order([['ruby-red/3-days', 11]])).body.status).toBe('0');
  });

  it('order 1: new buyer pays, becomes a member with the tickets', async function () {
    const o1 = await order([['ruby-red/3-days', 2], ['pearly-white/fri-sat', 1]]);
    expect(o1.body.status).toBe('1');
    expect(o1.body.paymentUrl).toMatch(/^http:\/\/site\.test\/shop\/pay\//);
    ref1 = refOf(o1.body.paymentUrl);
    expect(await one('SELECT amount, currency, status FROM shop.orders WHERE ref = $1', [ref1])).toEqual({ amount: '21000.00', currency: 'USD', status: 'pending' });

    const pay = await get(o1.body.paymentUrl);
    expect(pay.status).toBe(302);
    expect(pay.location).toMatch(/^https:\/\/secure\.telr\.example\//);
    expect((await get(o1.body.paymentUrl)).location).toBe(pay.location);
    expect(creates).toBe(1);

    const ret = SITE + '/shop/telr/return/' + encodeURIComponent(ref1);
    expect((await get(ret)).location).toBe(SITE + '/payment/pending?orderid=' + ref1);
    answers[ref1] = { code: 3, amount: '20000.00' };
    expect((await get(ret)).location).toBe(SITE + '/payment/pending?orderid=' + ref1);
    answers[ref1] = { code: 3 };
    expect((await get(ret)).location).toBe(SITE + '/thank-you?orderid=' + ref1);

    const done = await one('SELECT * FROM shop.orders WHERE ref = $1', [ref1]);
    expect(done).toMatchObject({ status: 'paid', error: null });
    expect(done.fulfilled_at).toBeTruthy();
    expect(done.tickets).toHaveLength(10);

    const user = await one('SELECT * FROM users WHERE email = $1', [email]);
    expect(user).toMatchObject({ role: 'MEMBER', status: 'PENDING_ACTIVATION' });
    expect((await one('SELECT COUNT(*) AS n FROM auth_tokens WHERE user_id = $1', [user.id])).n).toBe(0);
    const member = await one('SELECT * FROM members WHERE user_id = $1', [user.id]);
    memberId = member.id;
    expect(member.membership_number).toMatch(/^CJ300-\d{4}$/);
    expect(member).toMatchObject({ country: 'Pakistan', mobile: '+92 3001234567' });
    const ms = (await pool.query('SELECT m.*, t.slug FROM memberships m JOIN membership_tiers t ON t.id = m.tier_id WHERE member_id = $1', [member.id])).rows;
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ slug: 'pearly-white', status: 'INVITED', membership_number: member.membership_number });

    const tickets = (await pool.query('SELECT t.ticket_number, t.valid_from = tt.valid_from AS same_from, t.metadata FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE t.member_id = $1', [member.id])).rows;
    expect(tickets).toHaveLength(10);
    tickets.forEach(function (t) {
      expect(Boolean(t.same_from)).toBe(true);
      expect(t.metadata.order).toBe(ref1);
      expect(t.ticket_number).toMatch(/^[A-Z0-9]+-[A-Z]+-[23456789A-HJ-NP-Z]{6}$/);
    });
    expect((await one('SELECT COUNT(*) AS n FROM ticket_credentials c JOIN tickets t ON t.id = c.ticket_id WHERE t.member_id = $1 AND c.revoked_at IS NULL', [member.id])).n).toBe(10);

    const advice = await routes.advice.POST(new Request(SITE + '/shop/telr/advice', { method: 'POST', body: new URLSearchParams({ tran_cartid: ref1, tran_status: 'A' }) }));
    expect(advice.status).toBe(200);
    expect((await one('SELECT COUNT(*) AS n FROM tickets WHERE member_id = $1', [member.id])).n).toBe(10);
    expect((await routes.advice.POST(new Request(SITE + '/shop/telr/advice', { method: 'POST', body: '' }))).status).toBe(400);

    const log = mails.join('\n');
    expect(log).toContain('Subject: Your payment is confirmed – Club JOIA 300');
    expect(log).toContain('Arrangement / Ticket: 2 × Ruby Red, 3 days; 1 × Pearly White, Friday & Saturday');
    expect(log).toContain('please call us on +971 50 000 0000');
    // only the two designed emails: no tickets / activation email
    expect(log).not.toContain('Your Club JOIA 300 tickets');
    expect(log).not.toContain('/activate?token=');
  });

  it('order 2: the same member is upgraded', async function () {
    const o2 = await order([['ultra-black/fri-sun', 1]]);
    ref2 = refOf(o2.body.paymentUrl);
    await get(o2.body.paymentUrl);
    answers[ref2] = { code: 3 };
    expect((await get(SITE + '/shop/telr/return/' + ref2)).location).toBe(SITE + '/thank-you?orderid=' + ref2);
    expect((await one('SELECT COUNT(*) AS n FROM users WHERE lower(email) = lower($1)', [email])).n).toBe(1);
    const ms = (await pool.query('SELECT t.slug FROM memberships m JOIN membership_tiers t ON t.id = m.tier_id WHERE member_id = $1', [memberId])).rows;
    expect(ms).toEqual([{ slug: 'ultra-black' }]);
    const t2 = (await one('SELECT tickets FROM shop.orders WHERE ref = $1', [ref2])).tickets as string[];
    expect(t2).toHaveLength(4);
    expect(t2.some(function (n) { return /-PARK-/.test(n); })).toBe(true);
  });

  it('declined: one email with a retry link, which starts a new order', async function () {
    const o3 = await order([['ruby-red/fri-sat', 1]]);
    ref3 = refOf(o3.body.paymentUrl);
    await get(o3.body.paymentUrl);
    answers[ref3] = { code: -3 };
    expect((await get(SITE + '/shop/telr/return/' + ref3)).location).toBe(SITE + '/payment/denied?orderid=' + ref3);
    const retryLink = SITE + '/shop/retry/' + ref3;
    expect(mails.join('\n')).toContain('Subject: One more step to join us');
    expect(mails.join('\n')).toContain('Complete your payment: ' + retryLink);
    await get(SITE + '/shop/telr/return/' + ref3);
    expect(mails.join('\n').split('Complete your payment: ' + retryLink)).toHaveLength(2);

    const again = await get(retryLink);
    expect(again.status).toBe(302);
    ref3b = decodeURIComponent(String(again.location).split('/shop/pay/')[1] || '');
    expect(await one('SELECT retry_of, amount, status FROM shop.orders WHERE ref = $1', [ref3b])).toEqual({ retry_of: ref3, amount: '4000.00', status: 'pending' });
    expect((await get(String(again.location))).location).toMatch(/^https:\/\/secure\.telr\.example\//);
    answers[ref3b] = { code: 3 };
    expect((await get(SITE + '/shop/telr/return/' + ref3b)).location).toBe(SITE + '/thank-you?orderid=' + ref3b);
    expect((await get(retryLink)).location).toBe(SITE + '/thank-you?orderid=' + ref3b);
  });

  it('cancelled: the payment link doesn\'t reopen Telr', async function () {
    const o4 = await order([['ruby-red/fri-sat', 1]]);
    ref4 = refOf(o4.body.paymentUrl);
    await get(o4.body.paymentUrl);
    answers[ref4] = { code: -2 };
    expect((await get(SITE + '/shop/telr/return/' + ref4)).location).toBe(SITE + '/payment/cancel?orderid=' + ref4);
    expect((await get(o4.body.paymentUrl)).location).toMatch(/\/shop\/ticketing_error/);
    expect((await get(SITE + '/shop/telr/return/NOPE')).status).toBe(404);
  });

  it('limits unpaid orders per email (5) and per address (20) in an hour', async function () {
    const stamp = Date.now();
    const mail = function (n: number | string) { return 'shoptest+limit' + n + '-' + stamp + '@example.com'; };
    const place = async function (to: string, ip: string) {
      return (await api('buyTickets', Object.assign(buyer({ email: to }), { 'tickets[0][ticketId]': 'ruby-red/fri-sat', 'tickets[0][quantity]': '1', ip }))).body;
    };
    const refused = { status: '0', message: 'You have several unfinished orders. Please complete one of them or try again in an hour.' };

    for (let i = 0; i < 5; i++) expect((await place(mail('a'), '10.8.8.8')).status).toBe('1');
    expect(await place(mail('a'), '10.8.8.9')).toEqual(refused);
    expect(await place(mail('A'), '10.8.8.9')).toEqual(refused); // the same email in capitals
    expect((await place(mail('b'), '10.8.8.8')).status).toBe('1');

    for (let i = 0; i < 20; i++) expect((await place(mail(i), '10.7.7.7')).status).toBe('1');
    expect(await place(mail('z'), '10.7.7.7')).toEqual(refused);
    expect((await place(mail('z'), '10.7.7.8')).status).toBe('1');

    // an hour later the email can order again
    await pool.query('UPDATE shop.orders SET created_at = created_at - INTERVAL 2 HOUR WHERE email = $1', [mail('a')]);
    expect((await place(mail('a'), '10.8.8.8')).status).toBe('1');
  });

  it('serves the sales dashboard\'s API to signed-in admins only', async function () {
    const call = async function (method: 'GET' | 'POST', path: string, init: { key?: string; user?: string; body?: unknown } = {}) {
      const headers: Record<string, string> = { Authorization: 'Bearer ' + (init.key === undefined ? ADMIN_KEY : init.key) };
      if (init.user) headers['X-Admin-User'] = init.user;
      if (!init.key && init.key !== undefined) delete headers.Authorization;
      if (init.body) headers['Content-Type'] = 'application/json';
      const req = new Request(SITE + '/shop/admin/' + path, { method, headers, body: init.body ? JSON.stringify(init.body) : undefined });
      const r = await routes.admin[method](req, { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
      return { status: r.status, body: await r.json() };
    };
    expect((await call('POST', 'login', { key: 'wrong-key-wrong-key', body: { email: 'admin@joia.test', password: 'x' } })).status).toBe(401);
    expect((await call('POST', 'login', { body: { email: 'admin@joia.test', password: 'nope', ip: '10.9.9.9' } })).status).toBe(401);
    expect((await call('POST', 'login', { body: { email: 'alex.carter@joia.test', password: 'JoiaDev!2026-member', ip: '10.9.9.9' } })).status).toBe(401);
    // 5 wrong passwords per email in 15 minutes, counted in the database
    const nobody = 'shoptest+nobody' + Date.now() + '@example.com';
    for (let i = 0; i < 5; i++) expect((await call('POST', 'login', { body: { email: nobody, password: 'nope', ip: '10.6.6.6' } })).status).toBe(401);
    expect((await call('POST', 'login', { body: { email: nobody, password: 'nope', ip: '10.6.6.5' } })).status).toBe(429);
    expect((await one('SELECT COUNT(*) AS n FROM shop.sign_in_failures WHERE bucket = $1', ['email:' + nobody])).n).toBe(5);

    const signIn = await call('POST', 'login', { body: { email: 'Admin@joia.test', password: 'JoiaDev!2026-staff', ip: '10.9.9.9' } });
    expect(signIn.status).toBe(200);
    expect(signIn.body.user.role).toBe('SUPER_ADMIN');
    const id = signIn.body.user.id;
    expect((await call('GET', 'stats')).status).toBe(401);

    const q = 'q=' + encodeURIComponent(email);
    const st = (await call('GET', 'stats?' + q, { user: id })).body;
    expect(st.totals).toMatchObject({ orders: 5, paid: 3, revenue: 34750, tickets: 5, buyers: 1 });
    const byStatus = Object.fromEntries(st.byStatus.map(function (s: { status: string; orders: number }) { return [s.status, s.orders]; }));
    expect(byStatus).toMatchObject({ paid: 3, declined: 1, cancelled: 1, pending: 0 });
    const byType = Object.fromEntries(st.byTicketType.map(function (t: { code: string; tickets: number }) { return [t.code, t.tickets]; }));
    expect(byType).toMatchObject({ FRI: 5, SAT: 4, SUN: 3, AFTER: 3, PARK: 1 });
    const byTier = Object.fromEntries(st.byTier.map(function (t: { tier: string; revenue: number }) { return [t.tier, t.revenue]; }));
    expect(byTier).toMatchObject({ 'ruby-red': 20000, 'pearly-white': 5000, 'ultra-black': 9750 });
    expect(st.byCountry).toEqual([{ country: 'Pakistan', orders: 3, revenue: 34750 }]);

    const tierOnly = (await call('GET', 'stats?' + q + '&tier=ruby-red', { user: id })).body;
    expect(tierOnly.totals.paid).toBe(2);
    const list = (await call('GET', 'orders?' + q + '&status=paid', { user: id })).body;
    expect(list.orders.map(function (o: { ref: string }) { return o.ref; })).toEqual([ref3b, ref2, ref1]);
    const detail = (await call('GET', 'orders/' + ref1, { user: id })).body.order;
    expect(detail.member.number).toMatch(/^CJ300-/);
    expect(detail.ticketList).toHaveLength(10);
    expect(detail.telr.status).toBe(3);
    expect((await call('GET', 'orders/NOPE', { user: id })).status).toBe(404);
  });

  it('saves pre-registrations (the maintenance page\'s form), once per email, with spam checks', async function () {
    const stamp = Date.now();
    const ip = '10.5.' + (stamp % 250) + '.' + ((stamp >> 8) % 250);
    const who = 'shoptest+reg' + stamp + '@example.com';
    const send = async function (fields: Record<string, string>, headers: Record<string, string> = {}) {
      const form = new FormData();
      Object.keys(fields).forEach(function (k) { form.append(k, fields[k]); });
      const r = await routes.prereg.POST(new Request(SITE + '/api/preregister', { method: 'POST', body: form, headers: Object.assign({ 'X-Forwarded-For': ip, Host: 'site.test' }, headers) }));
      return { status: r.status, body: await r.json() };
    };
    const good = {
      first_name: 'Reg', last_name: 'Tester', email: who.toUpperCase(), phone: '+971 50 123 4567', country: 'UAE',
      tier_interest: 'Ultra Black', source: 'Instagram', message: '=1+1 hello', consent: 'on', started: String(stamp - 10000), website: ''
    };

    const bad = await send({ first_name: '', email: 'x', phone: '12', tier_interest: 'Gold', started: String(stamp - 10000) });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.fields).sort()).toEqual(['consent', 'country', 'email', 'first_name', 'last_name', 'phone', 'tier_interest']);
    expect((await send(good, { Origin: 'https://evil.example' })).status).toBe(403);
    // bots: the hidden field, or too fast: a pretended success, nothing saved
    expect((await send(Object.assign({}, good, { website: 'spam' }))).body).toEqual({ ok: true });
    expect((await send(Object.assign({}, good, { started: String(Date.now()) }))).body).toEqual({ ok: true });
    expect((await one('SELECT COUNT(*) AS n FROM pre_registrations WHERE email = $1', [who])).n).toBe(0);

    expect(await send(good, { Origin: 'http://site.test' })).toEqual({ status: 200, body: { ok: true } });
    expect(await send(Object.assign({}, good, { tier_interest: 'Ruby Red', marketing: 'on' }))).toEqual({ status: 200, body: { ok: true } });
    const rows = (await pool.query('SELECT * FROM pre_registrations WHERE email = $1', [who])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ first_name: 'Reg', tier_interest: 'Ruby Red', marketing_opt_in: 1, country: 'UAE' });
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows[0])).not.toContain(ip);
    const log = mails.join('\n');
    expect(log).toContain('To: team@example.com\nSubject: New pre-registration: Reg Tester');
    expect(log).toContain('Subject: Updated pre-registration: Reg Tester');
    expect(log).toContain('To: ' + who + '\nSubject: Your CLUB JOIA 300 pre-registration');

    // 5 per hour from one connection (the two saved ones count)
    for (let i = 0; i < 3; i++) expect((await send(Object.assign({}, good, { email: 'shoptest+reg' + stamp + '-' + i + '@example.com' }))).status).toBe(200);
    expect((await send(Object.assign({}, good, { email: 'shoptest+reg' + stamp + '-x@example.com' }))).status).toBe(429);

    // the dashboard's list
    const signIn = await routes.admin.POST(new Request(SITE + '/shop/admin/login', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@joia.test', password: 'JoiaDev!2026-staff', ip: '10.9.9.9' }) }), { params: Promise.resolve({ path: ['login'] }) });
    const id = (await signIn.json()).user.id;
    const list = await routes.admin.GET(new Request(SITE + '/shop/admin/registrations?q=' + encodeURIComponent('reg' + stamp), { headers: { Authorization: 'Bearer ' + ADMIN_KEY, 'X-Admin-User': id } }), { params: Promise.resolve({ path: ['registrations'] }) });
    const data = await list.json();
    expect(data.registrations).toHaveLength(4);
    expect(data.registrations.find(function (r: { email: string }) { return r.email === who; })).toMatchObject({ firstName: 'Reg', tier: 'Ruby Red', marketing: true, message: '=1+1 hello' });
    expect(data.total).toBeGreaterThanOrEqual(4);
  });
});

// Removes the test accounts (shoptest+...@example.com) and their orders. The members app's audit
// log is append-only (a trigger blocks deletes), so its rows of the test stay.
async function cleanup() {
  const users = (await pool.query("SELECT id FROM users WHERE email LIKE 'shoptest+%@example.com'")).rows;
  for (const u of users) {
    const mb = (await pool.query('SELECT id FROM members WHERE user_id = $1', [u.id])).rows[0];
    if (mb) {
      const ids = (await pool.query('SELECT id FROM tickets WHERE member_id = $1', [mb.id])).rows.map(function (r) { return r.id; });
      if (ids.length) {
        await pool.query('DELETE FROM ticket_check_ins WHERE ticket_id IN ($1)', [ids]);
        await pool.query('DELETE FROM ticket_scan_logs WHERE ticket_id IN ($1)', [ids]);
        await pool.query('DELETE FROM ticket_credentials WHERE ticket_id IN ($1)', [ids]);
        await pool.query('DELETE FROM tickets WHERE id IN ($1)', [ids]);
      }
      await pool.query('DELETE FROM memberships WHERE member_id = $1', [mb.id]);
      await pool.query('DELETE FROM notification_recipients WHERE member_id = $1', [mb.id]);
      await pool.query('DELETE FROM members WHERE id = $1', [mb.id]);
    }
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [u.id]);
    await pool.query('DELETE FROM auth_tokens WHERE user_id = $1', [u.id]);
    await pool.query('DELETE FROM consent_records WHERE user_id = $1', [u.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [u.id]).catch(function (e) {
      if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
      return pool.query(
        "UPDATE users SET email = CONCAT('removed-shoptest-', id, '@example.invalid'), name = 'Removed shop test', status = 'DISABLED', password_hash = NULL, updated_at = NOW(3) WHERE id = $1",
        [u.id]
      );
    });
  }
  await pool.query("DELETE FROM shop.orders WHERE email LIKE 'shoptest+%@example.com'");
  await pool.query("DELETE FROM pre_registrations WHERE email LIKE 'shoptest+%@example.com'");
  await pool.query("DELETE FROM shop.sign_in_failures WHERE bucket LIKE 'email:shoptest+%' OR bucket IN ('ip:10.6.6.6', 'ip:10.6.6.5', 'ip:10.9.9.9', 'email:admin@joia.test', 'email:alex.carter@joia.test')");
}
