/*
 * End-to-end test of the ticket shop's APIs (app/Api/Eventsnew, app/shop, app/api/pay) on a real
 * database with a stand-in IFZA: the site's calls, the payment (create, card, bank check's return,
 * status sweep), the member and tickets made, the emails, retry, and the sales dashboard's API.
 * Removes what it made.
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
import { encryptTotpSecret, generateTotpSecret, totpCode, totpStep } from '@/lib/shop/totp';

const DB_URL = process.env.SHOP_TEST_DATABASE_URL || '';
const CHECK_URL = process.env.SHOP_TEST_ADMIN_DATABASE_URL || DB_URL;
const SITE = 'http://site.test';
const EVENT = process.env.SHOP_TEST_EVENT || 'abu-dhabi-2026';
const ADMIN_KEY = 'shop-test-admin-key-0123456789';
const email = 'shoptest+' + Date.now() + '@example.com';
// the seeded admin's authenticator during the test (its own settings are put back afterwards)
const MFA_KEY = 'shop-test-mfa-key-shop-test-mfa-key-0001';
const MFA_SECRET = generateTotpSecret();
let adminMfa: { id: string; mfa_enabled: number; mfa_secret_encrypted: string | null; mfa_enrolled_at: string | null; mfa_last_used_step: number | null } | null = null;

// ─── Stand-in IFZA: create, checkout and status; answers[reference] sets what a status says ───
const IFZA_KEY = 'ifza_ik_live_TESTKEY_0123456789';
type StubPayment = { id: string; reference: string; amount: number; currency: string; status: string; checkedOut: boolean; customer: Record<string, string> };
const payments: Record<string, StubPayment> = {};
const answers: Record<string, { status: string; amount?: number; currency?: string; reference?: string }> = {};
let creates = 0;
let stub: http.Server;

function startStub(): Promise<string> {
  stub = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      const p = body ? JSON.parse(body) : {};
      const send = function (status: number, o: unknown) { res.writeHead(status, { 'Content-Type': 'application/json', 'X-Api-Key-Mode': 'test' }); res.end(JSON.stringify(o)); };
      if (req.headers['x-api-key'] !== IFZA_KEY) return send(401, { ok: false, error: 'invalid_key' });
      if (req.url === '/api/integrations/v1/payments') {
        const c = p.customer || {};
        if (p.store !== 'Elixium-Events-Test' || !(p.amount > 0) || !p.reference || !p.return_url || !c.address1 || !c.city || !/^[A-Z]{2}$/.test(c.country || '')) {
          return send(422, { ok: false, error: 'validation_error', issues: [{ path: 'customer' }] });
        }
        if (Object.values(payments).some(function (x) { return x.reference === p.reference; })) return send(409, { ok: false, error: 'duplicate_reference' });
        creates++;
        const id = 'pay_stub' + creates;
        payments[id] = { id, reference: p.reference, amount: p.amount, currency: p.currency, status: 'CREATED', checkedOut: false, customer: c };
        return send(200, { ok: true, payment_id: id, expires_at: new Date(Date.now() + 30 * 60000).toISOString(), telr_init: { store_id: 12345, currency: p.currency, test_mode: 1 } });
      }
      if (req.url === '/api/integrations/v1/payments/checkout') {
        const x = payments[p.payment_id];
        if (!p.payment_id || !p.card_token) return send(422, { ok: false, error: 'validation_error' });
        if (!x) return send(404, { ok: false, error: 'not_found' });
        if (x.checkedOut) return send(409, { ok: false, error: 'already_checked_out' });
        x.checkedOut = true;
        if (p.card_token === 'refused') { x.status = 'DECLINED'; return send(502, { ok: false, error: 'telr_error', message: 'Card refused' }); }
        return send(200, { ok: true, order_url: 'https://secure.telr.example/gateway/process_framed.html?o=' + x.id });
      }
      if (req.url === '/api/integrations/v1/payments/status') {
        const x = payments[p.payment_id];
        if (!x) return send(404, { ok: false, error: 'not_found' });
        const a = answers[x.reference] || { status: x.status };
        return send(200, { ok: true, payment_id: x.id, reference: a.reference || x.reference, status: a.status, amount: a.amount !== undefined ? a.amount : x.amount, currency: a.currency || x.currency, transaction_ref: '0400' + x.id });
      }
      send(404, { ok: false, error: 'not_found' });
    });
  });
  return new Promise(function (resolve) {
    stub.listen(0, '127.0.0.1', function () { resolve('http://127.0.0.1:' + (stub.address() as AddressInfo).port); });
  });
}

// ─── The route handlers, called as Next calls them ───
type Ctx<P> = { params: Promise<P> };
let routes: {
  api: { POST: (r: Request, c: Ctx<{ name: string }>) => Promise<Response> };
  pay: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  ret: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  card: { POST: (r: Request) => Promise<Response> };
  status: { POST: (r: Request) => Promise<Response> };
  retry: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  admin: { GET: (r: Request, c: Ctx<{ path: string[] }>) => Promise<Response>; POST: (r: Request, c: Ctx<{ path: string[] }>) => Promise<Response> };
  prereg: { POST: (r: Request) => Promise<Response> };
};
let closeDb: () => Promise<void>;
// the test's own connection (the owner's), queries written as the shop's (lib/shop/db.ts)
let raw: mysql.Pool;
// when the run began: the rate-limit counters it starts are removed after it (so a second run isn't limited)
let runStart = '';
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

// a GET of a /shop/... link: { status, location } (the return page's is where it sends the window)
async function get(url: string) {
  const path = new URL(url).pathname.split('/').map(decodeURIComponent);
  const req = new Request(url);
  let r: Response;
  if (path[2] === 'pay') r = await routes.pay.GET(req, { params: Promise.resolve({ ref: path[3] }) });
  else if (path[2] === 'return') r = await routes.ret.GET(req, { params: Promise.resolve({ ref: path[3] }) });
  else if (path[2] === 'retry') r = await routes.retry.GET(req, { params: Promise.resolve({ ref: path[3] }) });
  else throw new Error('no route for ' + url);
  return { status: r.status, location: r.headers.get('location') || r.headers.get('x-next-page') };
}

// the /pay page's work: the order's payment (lib/shop/orders preparePayment)
async function payState(ref: string) {
  return (await import('@/lib/shop/orders')).preparePayment(ref);
}

// the card form's token sent (app/api/pay): { status, body }
async function card(ref: string, token = 'tok_ok') {
  const r = await routes.card.POST(new Request(SITE + '/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, token }) }));
  return { status: r.status, body: await r.json() };
}

// a payment up to the bank's check: the page, then the card
async function toBank(ref: string) {
  expect((await payState(ref))!.state).toBe('ready');
  const c = await card(ref);
  expect(c.body.orderUrl).toMatch(/^https:\/\/secure\.telr\.example\//);
}

const back = function (ref: string) { return SITE + '/shop/return/' + encodeURIComponent(ref) + '?payment_id=x&outcome=authorised'; };

function buyer(extra: Record<string, string> = {}) {
  return Object.assign({
    name: 'Shop', surname: 'Tester', email, address: 'Street 1', zipcode: '12345', city: 'Lahore',
    country: 'pakistan', countryPhoneCode: '+92', phoneNumber: '3001234567'
  }, extra);
}

function order(lines: [string, number][], to = email) {
  const form: Record<string, string> = buyer({ email: to });
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

// the admin's current code; each code works once, so the test forgets the last one used first
function freshCode(): string;
function freshCode(reset: true): Promise<string>;
function freshCode(reset?: boolean): string | Promise<string> {
  const code = totpCode(MFA_SECRET, totpStep());
  if (!reset) return code;
  return raw.query('UPDATE users SET mfa_last_used_step = NULL WHERE email = ?', ['admin@joia.test']).then(function () { return code; });
}

const one = function (sql: string, params: unknown[] = []) { return pool.query(sql, params).then(function (r) { return r.rows[0]; }); };

describe.skipIf(!DB_URL)('ticket shop on a database', function () {
  beforeAll(async function () {
    Object.assign(process.env, {
      ...dbEnv(DB_URL), SHOP_EVENT: EVENT, SHOP_CURRENCY: 'USD', SHOP_SITE_URL: SITE, SHOP_PUBLIC_URL: '',
      SHOP_ADMIN_KEY: ADMIN_KEY, IFZA_API_KEY: IFZA_KEY, IFZA_STORE: 'Elixium-Events-Test', IFZA_URL: await startStub(), IFZA_MAX_CALLS: '100000',
      EMAIL_DRIVER: 'console', SHOP_SUPPORT_PHONE: '+971 50 000 0000', PREREG_NOTIFY_EMAIL: 'team@example.com', PREREG_SEND_CONFIRMATION: '1',
      MFA_ENCRYPTION_KEY: MFA_KEY
    });
    vi.spyOn(console, 'info').mockImplementation(function (...a: unknown[]) { mails.push(a.join(' ')); });
    vi.spyOn(console, 'error').mockImplementation(function () {});
    raw = mysql.createPool({ uri: CHECK_URL, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 2 });
    toMysql = (await import('@/lib/shop/db')).toMysql;
    routes = {
      api: await import('@/app/Api/Eventsnew/[name]/route'),
      pay: await import('@/app/shop/pay/[ref]/route'),
      ret: await import('@/app/shop/return/[ref]/route'),
      card: await import('@/app/api/pay/route'),
      status: await import('@/app/api/pay/status/route'),
      retry: await import('@/app/shop/retry/[ref]/route'),
      admin: await import('@/app/shop/admin/[...path]/route'),
      prereg: await import('@/app/api/preregister/route')
    };
    closeDb = (await import('@/lib/shop/db')).closeDb;

    // the seeded admin gets an authenticator for the test
    adminMfa = (await raw.query('SELECT id, mfa_enabled, mfa_secret_encrypted, mfa_enrolled_at, mfa_last_used_step FROM users WHERE email = ?', ['admin@joia.test']) as any)[0][0];
    await raw.query('UPDATE users SET mfa_enabled = 1, mfa_secret_encrypted = ?, mfa_last_used_step = NULL WHERE email = ?', [encryptTotpSecret(MFA_SECRET, MFA_KEY), 'admin@joia.test']);
    runStart = (await one("SELECT DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%d %H:%i:%s.%f') AS t")).t;
  });

  afterAll(async function () {
    if (adminMfa) {
      await raw.query('UPDATE users SET mfa_enabled = ?, mfa_secret_encrypted = ?, mfa_enrolled_at = ?, mfa_last_used_step = ? WHERE id = ?',
        [adminMfa.mfa_enabled, adminMfa.mfa_secret_encrypted, adminMfa.mfa_enrolled_at, adminMfa.mfa_last_used_step, adminMfa.id]).catch(function (e) { process.stderr.write('mfa restore: ' + e + '\n'); });
      // the test's wrong passwords and codes, so a second run within 15 minutes isn't locked out
      await pool.query('DELETE FROM shop.sign_in_failures WHERE bucket IN ($1)', [['email:admin@joia.test', 'ip:10.9.9.8', 'ip:10.9.9.9']]).catch(function () {});
    }
    if (runStart) await pool.query('DELETE FROM shop.rate_limits WHERE window_start >= $1', [runStart]).catch(function (e) { process.stderr.write('rate limits: ' + e + '\n'); });
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

    // the payment link: the site's payment page
    const pay = await get(o1.body.paymentUrl);
    expect(pay).toEqual({ status: 302, location: SITE + '/pay/' + ref1 });

    // the page makes the IFZA payment once, with the billing address and our amount
    const ready = await payState(ref1);
    expect(ready).toMatchObject({ state: 'ready', ref: ref1, amount: 21000, currency: 'USD', init: { store_id: 12345, currency: 'USD', test_mode: 1 } });
    expect((await payState(ref1))!.state).toBe('ready');
    expect(creates).toBe(1);
    const p1 = Object.values(payments).find(function (x) { return x.reference === ref1; })!;
    expect(p1).toMatchObject({ amount: 21000, currency: 'USD' });
    expect(p1.customer).toMatchObject({ address1: 'Street 1', city: 'Lahore', country: 'PK', firstName: 'Shop', lastName: 'Tester', phone: '+923001234567' });
    const row = await one('SELECT pay_id, pay_status, pay_expires_at > UTC_TIMESTAMP(3) AS open FROM shop.orders WHERE ref = $1', [ref1]);
    expect(row).toMatchObject({ pay_id: p1.id, pay_status: 'CREATED', open: 1 });

    // the card: the bank's check; the same payment can't be checked out twice
    expect((await card(ref1, '')).status).toBe(400);
    const c1 = await card(ref1);
    expect(c1).toEqual({ status: 200, body: { orderUrl: 'https://secure.telr.example/gateway/process_framed.html?o=' + p1.id } });
    expect((await payState(ref1))).toEqual({ state: 'done', page: SITE + '/payment/pending?orderid=' + ref1 });

    // back from the bank: only IFZA's PAID of our amount counts, never the outcome in the address
    expect((await get(back(ref1))).location).toBe(SITE + '/payment/pending?orderid=' + ref1);
    answers[ref1] = { status: 'PAID', amount: 20000 };
    expect((await get(back(ref1))).location).toBe(SITE + '/payment/pending?orderid=' + ref1);
    answers[ref1] = { status: 'PAID', currency: 'AED' };
    expect((await get(back(ref1))).location).toBe(SITE + '/payment/pending?orderid=' + ref1);
    answers[ref1] = { status: 'PAID' };
    expect((await get(back(ref1))).location).toBe(SITE + '/thank-you?orderid=' + ref1);

    const done = await one('SELECT * FROM shop.orders WHERE ref = $1', [ref1]);
    expect(done).toMatchObject({ status: 'paid', error: null });
    expect(done.fulfilled_at).toBeTruthy();
    expect(done.tickets).toHaveLength(10);

    // every IFZA call is in the payment logs, with IFZA's answer; the card token never is
    const logs = (await pool.query('SELECT call_name, reference, payment_id, http_status, request, response FROM shop.payment_logs WHERE reference = $1 OR payment_id = $2 ORDER BY id', [ref1, p1.id])).rows;
    expect(logs[0]).toMatchObject({ call_name: 'create', reference: ref1, payment_id: p1.id, http_status: 200 });
    expect(logs[0].request).toMatchObject({ reference: ref1, amount: 21000, currency: 'USD', customer: { country: 'PK' } });
    expect(JSON.parse(logs[0].response)).toMatchObject({ ok: true, payment_id: p1.id });
    const checkouts = logs.filter(function (l) { return l.call_name === 'checkout'; });
    expect(checkouts.length).toBeGreaterThan(0);
    checkouts.forEach(function (l) { expect(l.request).toEqual({ payment_id: p1.id, card_token: '[hidden]' }); });
    expect(logs.filter(function (l) { return l.call_name === 'status'; }).length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(logs)).not.toContain('tok_ok');
    expect(JSON.stringify(logs)).not.toContain(IFZA_KEY);

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

    // a second return (or the sweep) makes nothing twice
    expect((await get(back(ref1))).location).toBe(SITE + '/thank-you?orderid=' + ref1);
    expect((await one('SELECT COUNT(*) AS n FROM tickets WHERE member_id = $1', [member.id])).n).toBe(10);
    expect((await card(ref1)).body).toEqual({ page: SITE + '/thank-you?orderid=' + ref1 });

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
    await toBank(ref2);
    // the buyer pays and closes the page: the sweep finds it (orders untouched for 2 minutes)
    answers[ref2] = { status: 'PAID' };
    const { sweep } = await import('@/lib/shop/orders');
    await pool.query('UPDATE shop.orders SET updated_at = UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE WHERE ref = $1', [ref2]);
    expect(await sweep(100)).toBeGreaterThanOrEqual(1);
    expect(await one('SELECT status, fulfilled_at IS NOT NULL AS done FROM shop.orders WHERE ref = $1', [ref2])).toEqual({ status: 'paid', done: 1 });
    expect((await get(back(ref2))).location).toBe(SITE + '/thank-you?orderid=' + ref2);
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
    await toBank(ref3);
    answers[ref3] = { status: 'DECLINED' };
    expect((await get(back(ref3))).location).toBe(SITE + '/payment/denied?orderid=' + ref3);
    const retryLink = SITE + '/shop/retry/' + ref3;
    expect(mails.join('\n')).toContain('Subject: One more step to join us');
    expect(mails.join('\n')).toContain('Complete your payment: ' + retryLink);
    await get(back(ref3));
    expect(mails.join('\n').split('Complete your payment: ' + retryLink)).toHaveLength(2);

    const again = await get(retryLink);
    expect(again.status).toBe(302);
    ref3b = decodeURIComponent(String(again.location).split('/shop/pay/')[1] || '');
    expect(await one('SELECT retry_of, amount, status FROM shop.orders WHERE ref = $1', [ref3b])).toEqual({ retry_of: ref3, amount: '4000.00', status: 'pending' });
    expect((await get(String(again.location))).location).toBe(SITE + '/pay/' + ref3b);
    await toBank(ref3b);
    answers[ref3b] = { status: 'PAID' };
    expect((await get(back(ref3b))).location).toBe(SITE + '/thank-you?orderid=' + ref3b);
    expect((await get(retryLink)).location).toBe(SITE + '/thank-you?orderid=' + ref3b);
  });

  it('cancelled: the payment link doesn\'t open the card form again', async function () {
    const o4 = await order([['ruby-red/fri-sat', 1]]);
    ref4 = refOf(o4.body.paymentUrl);
    await toBank(ref4);
    answers[ref4] = { status: 'CANCELLED' };

    // back inside the frame (IFZA's guide): the page only tells the payment page, which asks our server
    const framed = await routes.ret.GET(new Request(back(ref4), { headers: { 'Sec-Fetch-Dest': 'iframe' } }), { params: Promise.resolve({ ref: ref4 }) });
    expect(framed.headers.get('x-return')).toBe('frame');
    const html = await framed.text();
    expect(html).toContain('window.top.postMessage(');
    expect(html).toContain('cj300-payment-return');
    expect(html).toContain(',location.origin)');
    expect(html).toContain('/shop/return/' + ref4 + '?payment_id=x&outcome=authorised&whole=1');
    expect((await one('SELECT status FROM shop.orders WHERE ref = $1', [ref4])).status).toBe('pending');
    const asked = await routes.status.POST(new Request(SITE + '/api/pay/status', { method: 'POST', body: JSON.stringify({ ref: ref4 }) }));
    expect(await asked.json()).toEqual({ page: SITE + '/payment/cancel?orderid=' + ref4 });
    expect((await routes.status.POST(new Request(SITE + '/api/pay/status', { method: 'POST', body: JSON.stringify({ ref: 'NOPE1' }) }))).status).toBe(404);

    // as the whole page (or a browser that doesn't say): the server asks itself
    expect((await get(back(ref4))).location).toBe(SITE + '/payment/cancel?orderid=' + ref4);
    expect((await get(back(ref4) + '&whole=1')).location).toBe(SITE + '/payment/cancel?orderid=' + ref4);
    expect((await get(o4.body.paymentUrl)).location).toMatch(/\/shop\/ticketing_error/);
    expect(await payState(ref4)).toEqual({ state: 'done', page: SITE + '/payment/cancel?orderid=' + ref4 });
    expect((await get(SITE + '/shop/return/NOPE')).status).toBe(404);
  });

  it('a card the gateway refuses: declined at once, with the retry email', async function () {
    const o = await order([['ruby-red/fri-sat', 1]], 'shoptest+refused-' + Date.now() + '@example.com');
    const ref = refOf(o.body.paymentUrl);
    expect((await payState(ref))!.state).toBe('ready');
    expect((await card(ref, 'refused')).body).toEqual({ page: SITE + '/payment/denied?orderid=' + ref });
    expect(await one('SELECT status, pay_status FROM shop.orders WHERE ref = $1', [ref])).toEqual({ status: 'declined', pay_status: 'REFUSED' });
    expect(mails.join('\n')).toContain('Complete your payment: ' + SITE + '/shop/retry/' + ref);
  });

  it('an order whose half hour is over: no payment, start again', async function () {
    const late = 'shoptest+late-' + Date.now() + '@example.com';
    const o = await order([['ruby-red/fri-sat', 1]], late);
    const ref = refOf(o.body.paymentUrl);
    await pool.query('UPDATE shop.orders SET created_at = created_at - INTERVAL 31 MINUTE WHERE ref = $1', [ref]);
    const before = creates;
    expect(await payState(ref)).toEqual({ state: 'expired', ref });
    expect(creates).toBe(before);
    // a payment made in time but now past IFZA's expiry
    const o2 = await order([['ruby-red/fri-sat', 1]], late);
    const ref2b = refOf(o2.body.paymentUrl);
    expect((await payState(ref2b))!.state).toBe('ready');
    await pool.query('UPDATE shop.orders SET pay_expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE ref = $1', [ref2b]);
    expect(await payState(ref2b)).toEqual({ state: 'expired', ref: ref2b });
    expect((await card(ref2b)).body).toEqual({ error: 'This payment has expired. Please start again: you have not been charged.', retry: false });
  });

  it('limits unpaid orders per email (50) and per address (50) in an hour', async function () {
    const stamp = Date.now();
    const mail = function (n: number | string) { return 'shoptest+limit' + n + '-' + stamp + '@example.com'; };
    const place = async function (to: string, ip: string) {
      return (await api('buyTickets', Object.assign(buyer({ email: to }), { 'tickets[0][ticketId]': 'ruby-red/fri-sat', 'tickets[0][quantity]': '1', ip }))).body;
    };
    const refused = { status: '0', message: 'You have several unfinished orders. Please complete one of them or try again in an hour.' };

    for (let i = 0; i < 50; i++) expect((await place(mail('a'), '10.8.8.8')).status).toBe('1');
    expect(await place(mail('a'), '10.8.8.9')).toEqual(refused);
    expect(await place(mail('A'), '10.8.8.9')).toEqual(refused); // the same email in capitals
    expect((await place(mail('b'), '10.8.8.10')).status).toBe('1');

    for (let i = 0; i < 50; i++) expect((await place(mail(i), '10.7.7.7')).status).toBe('1');
    expect(await place(mail('z'), '10.7.7.7')).toEqual(refused);
    expect((await place(mail('z'), '10.7.7.8')).status).toBe('1');

    // an hour later the email can order again
    await pool.query('UPDATE shop.orders SET created_at = created_at - INTERVAL 2 HOUR WHERE email = $1', [mail('a')]);
    expect((await place(mail('a'), '10.8.8.8')).status).toBe('1');
  }, 30000);

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

    // two-factor: the password alone isn't enough, a wrong or used code neither
    const pw = { email: 'Admin@joia.test', password: 'JoiaDev!2026-staff', ip: '10.9.9.8' };
    const noCode = await call('POST', 'login', { body: pw });
    expect(noCode.status).toBe(401);
    expect(noCode.body.error).toMatch(/6-digit code/);
    const wrong = String((Number(totpCode(MFA_SECRET, totpStep())) + 1) % 1000000).padStart(6, '0');
    expect((await call('POST', 'login', { body: { ...pw, code: wrong } })).status).toBe(401);
    expect((await call('POST', 'login', { body: { ...pw, code: freshCode() } })).status).toBe(200);
    expect((await call('POST', 'login', { body: { ...pw, code: totpCode(MFA_SECRET, totpStep()) } })).status).toBe(401);
    // without an authenticator set up in the members app: refused
    await raw.query('UPDATE users SET mfa_enabled = 0 WHERE email = ?', ['admin@joia.test']);
    const notSetUp = await call('POST', 'login', { body: { ...pw, code: freshCode() } });
    expect(notSetUp.status).toBe(403);
    expect(notSetUp.body.error).toMatch(/staff portal/);
    await raw.query('UPDATE users SET mfa_enabled = 1, mfa_last_used_step = NULL WHERE email = ?', ['admin@joia.test']);

    const signIn = await call('POST', 'login', { body: { email: 'Admin@joia.test', password: 'JoiaDev!2026-staff', ip: '10.9.9.9', code: freshCode() } });
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
    expect(detail.payment).toMatchObject({ status: 'PAID' });
    expect(detail.payment.id).toMatch(/^pay_stub/);
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
      first_name: 'Reg', last_name: 'Tester', email: who.toUpperCase(), phone: '+971 50 123 4567', country: 'United Arab Emirates',
      tier_interest: 'Ultra Black', source: 'Instagram', message: '=1+1 hello', consent: 'on', started: String(stamp - 10000), website: ''
    };

    const bad = await send({ first_name: '', email: 'x', phone: '12', tier_interest: 'Gold', started: String(stamp - 10000) });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.fields).sort()).toEqual(['consent', 'country', 'email', 'first_name', 'last_name', 'phone', 'tier_interest']);
    // only a country of the form's list (lib/countries)
    const unknown = await send(Object.assign({}, good, { country: 'Atlantis' }));
    expect([unknown.status, Object.keys(unknown.body.fields)]).toEqual([422, ['country']]);
    expect((await send(good, { Origin: 'https://evil.example' })).status).toBe(403);
    // bots: the hidden field, or too fast: a pretended success, nothing saved
    expect((await send(Object.assign({}, good, { website: 'spam' }))).body).toEqual({ ok: true });
    expect((await send(Object.assign({}, good, { started: String(Date.now()) }))).body).toEqual({ ok: true });
    expect((await one('SELECT COUNT(*) AS n FROM pre_registrations WHERE email = $1', [who])).n).toBe(0);

    expect(await send(good, { Origin: 'http://site.test' })).toEqual({ status: 200, body: { ok: true } });
    expect(await send(Object.assign({}, good, { tier_interest: 'Ruby Red', marketing: 'on' }))).toEqual({ status: 200, body: { ok: true } });
    // every submission is a row of its own, the same email too
    const rows = (await pool.query('SELECT * FROM pre_registrations WHERE email = $1 ORDER BY id', [who])).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tier_interest: 'Ultra Black', marketing_opt_in: 0 });
    expect(rows[1]).toMatchObject({ first_name: 'Reg', tier_interest: 'Ruby Red', marketing_opt_in: 1, country: 'United Arab Emirates' });
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows[0])).not.toContain(ip);
    const log = mails.join('\n');
    expect(log).toContain('To: team@example.com\nSubject: New pre-registration: Reg Tester');
    expect(log).toContain('Subject: Repeat pre-registration: Reg Tester');
    expect(log).toContain('To: ' + who + '\nSubject: Your CLUB JOIA 300 pre-registration');

    // 5 per hour from one connection (the two saved ones count)
    for (let i = 0; i < 3; i++) expect((await send(Object.assign({}, good, { email: 'shoptest+reg' + stamp + '-' + i + '@example.com' }))).status).toBe(200);
    expect((await send(Object.assign({}, good, { email: 'shoptest+reg' + stamp + '-x@example.com' }))).status).toBe(429);

    // the dashboard's list
    const signIn = await routes.admin.POST(new Request(SITE + '/shop/admin/login', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@joia.test', password: 'JoiaDev!2026-staff', ip: '10.9.9.9', code: await freshCode(true) }) }), { params: Promise.resolve({ path: ['login'] }) });
    const id = (await signIn.json()).user.id;
    const list = await routes.admin.GET(new Request(SITE + '/shop/admin/registrations?q=' + encodeURIComponent('reg' + stamp), { headers: { Authorization: 'Bearer ' + ADMIN_KEY, 'X-Admin-User': id } }), { params: Promise.resolve({ path: ['registrations'] }) });
    const data = await list.json();
    expect(data.registrations).toHaveLength(5);
    expect(data.registrations.find(function (r: { email: string }) { return r.email === who; })).toMatchObject({ firstName: 'Reg', tier: 'Ruby Red', marketing: true, message: '=1+1 hello' });
    expect(data.total).toBeGreaterThanOrEqual(5);
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
  await pool.query("DELETE FROM shop.payment_logs WHERE reference IN (SELECT ref FROM shop.orders WHERE email LIKE 'shoptest+%@example.com') OR payment_id IN (SELECT pay_id FROM shop.orders WHERE email LIKE 'shoptest+%@example.com' AND pay_id IS NOT NULL)");
  await pool.query("DELETE FROM shop.orders WHERE email LIKE 'shoptest+%@example.com'");
  await pool.query("DELETE FROM pre_registrations WHERE email LIKE 'shoptest+%@example.com'");
  await pool.query("DELETE FROM shop.sign_in_failures WHERE bucket LIKE 'email:shoptest+%' OR bucket IN ('ip:10.6.6.6', 'ip:10.6.6.5', 'ip:10.9.9.9', 'email:admin@joia.test', 'email:alex.carter@joia.test')");
}
