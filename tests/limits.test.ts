/*
 * The site's rate limits, tried every way on a real database (never the live one):
 *
 *   dashboard sign-in + MFA  (lib/shop/admin.ts)   5 failures per email, 20 per address, 15 minutes
 *   pre-registration form    (lib/preregister.ts)  5 per hour per connection
 *   checkout                 (lib/shop/orders.ts)  5 unpaid orders per email, 20 per address, 1 hour
 *
 *   payment                  /api/pay, /api/pay/status, /shop/return, /shop/retry, IFZA's call cap
 *
 * For each: the limit itself, other emails/addresses unaffected, the window ending, what counts and
 * what doesn't, parallel requests, and a made-up X-Forwarded-For entry (only nginx's last one counts).
 *   SHOP_TEST_DATABASE_URL=mysql://user:password@host:3306/database npx vitest run tests/limits.test.ts
 * Skipped without it. Removes what it made.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encryptTotpSecret, generateTotpSecret, totpCode, totpStep } from '@/lib/shop/totp';

const DB_URL = process.env.SHOP_TEST_DATABASE_URL || '';
const SITE = 'http://site.test';
const EVENT = process.env.SHOP_TEST_EVENT || 'abu-dhabi-2026';
const ADMIN_KEY = 'limits-test-admin-key-0123456789';
const MFA_KEY = 'limits-test-mfa-key-limits-test-mfa-key-01';
const MFA_SECRET = generateTotpSecret();
const ADMIN = 'admin@joia.test';
const ADMIN_PASSWORD = 'JoiaDev!2026-staff';
const IFZA_KEY = 'ifza_ik_live_LIMITSTEST_000';
const STAMP = Date.now();
// addresses of this run only (10.88.x.y), so runs don't count against each other
let ipSeq = 0;
function freshIp(): string { ipSeq++; return '10.88.' + ((STAMP + ipSeq) % 250) + '.' + (ipSeq % 250); }
function mail(tag: string): string { return 'shoptest+lim-' + tag + '-' + STAMP + '@example.com'; }

type Ctx<P> = { params: Promise<P> };
let routes: {
  admin: { POST: (r: Request, c: Ctx<{ path: string[] }>) => Promise<Response> };
  prereg: { POST: (r: Request) => Promise<Response> };
  checkout: { POST: (r: Request) => Promise<Response> };
  pay: { POST: (r: Request) => Promise<Response> };
  status: { POST: (r: Request) => Promise<Response> };
  ret: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
  retry: { GET: (r: Request, c: Ctx<{ ref: string }>) => Promise<Response> };
};
let raw: mysql.Pool;
let closeDb: () => Promise<void>;
let adminSaved: Record<string, unknown> | null = null;
let stub: http.Server;
const usedIps: string[] = [];
// the limit keys this run used (shop_rate_limits stores them hashed), removed afterwards
const usedKeys: string[] = ['ifza:calls'];

// ─── a stand-in IFZA: makes payments, refuses every card token (422, so a card can be tried
// again), answers PENDING to a status; counts the calls ───
const ifzaCalls = { create: 0, checkout: 0, status: 0 };
function startStub(): Promise<string> {
  let n = 0;
  stub = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      const p = body ? JSON.parse(body) : {};
      const send = function (status: number, o: unknown) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url === '/api/integrations/v1/payments/checkout') { ifzaCalls.checkout++; return send(422, { ok: false, error: 'validation_error' }); }
      if (req.url === '/api/integrations/v1/payments/status') { ifzaCalls.status++; return send(200, { ok: true, payment_id: p.payment_id, status: 'PENDING' }); }
      ifzaCalls.create++;
      send(200, { ok: true, payment_id: 'pay_lim' + (++n), expires_at: new Date(Date.now() + 1800000).toISOString(), telr_init: { store_id: 1, currency: 'USD', test_mode: 1 } });
    });
  });
  return new Promise(function (resolve) { stub.listen(0, '127.0.0.1', function () { resolve('http://127.0.0.1:' + (stub.address() as AddressInfo).port); }); });
}

function dbEnv(address: string) {
  const u = new URL(address);
  return { DB_HOST: u.hostname, DB_PORT: u.port || '3306', DB_USER: decodeURIComponent(u.username), DB_PASSWORD: decodeURIComponent(u.password), DB_NAME: decodeURIComponent(u.pathname.slice(1)) };
}

async function q(sql: string, params: unknown[] = []) {
  const [r] = await raw.query(sql, params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return r as any;
}

// ─── dashboard sign-in (the API the dashboard's sign-in form calls) ───
async function signIn(body: Record<string, unknown>) {
  const r = await routes.admin.POST(new Request(SITE + '/shop/admin/login', {
    method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), { params: Promise.resolve({ path: ['login'] }) });
  return { status: r.status, body: await r.json() };
}
// the admin's current code, forgetting the last one used (each code works once)
async function code(): Promise<string> {
  await q('UPDATE users SET mfa_last_used_step = NULL WHERE email = ?', [ADMIN]);
  return totpCode(MFA_SECRET, totpStep());
}
async function forgetFailures(...buckets: string[]) {
  await q('DELETE FROM shop_sign_in_failures WHERE bucket IN (?)', [buckets]);
}

// ─── pre-registration form ───
const goodForm = function (email: string): Record<string, string> {
  return {
    first_name: 'Limit', last_name: 'Tester', email, phone: '+971 50 123 4567', country: 'United Arab Emirates',
    tier_interest: 'Ruby Red', consent: 'on', started: String(Date.now() - 10000), website: ''
  };
};
async function preregister(fields: Record<string, string>, forwardedFor: string) {
  const form = new FormData();
  Object.keys(fields).forEach(function (k) { form.append(k, fields[k]); });
  const r = await routes.prereg.POST(new Request(SITE + '/api/preregister', { method: 'POST', body: form, headers: { 'X-Forwarded-For': forwardedFor, Host: 'site.test' } }));
  return { status: r.status, body: await r.json() };
}

// ─── checkout (the summary page's form) ───
async function checkout(email: string, forwardedFor: string) {
  const buyer = {
    firstName: 'Limit', lastName: 'Tester', email, repeatEmail: email, address: 'Street 1', zipcode: '54000', city: 'Lahore', country: 'PK',
    gender: '', birthday: '', phoneCode: 'PK', phone: '3001234567', over21: true, terms: true
  };
  const r = await routes.checkout.POST(new Request(SITE + '/api/checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
    body: JSON.stringify({ items: [{ id: 'ruby-red/fri-sat', quantity: 1 }], buyer })
  }));
  return { status: r.status, body: await r.json() };
}
const UNFINISHED = 'You have several unfinished orders. Please complete one of them or try again in an hour.';

// ─── payment ───
const TOO_MANY_PAY = 'Too many attempts. Please wait a few minutes and try again. You have not been charged.';
async function newOrder(tag: string): Promise<string> {
  const r = await checkout(mail(tag), freshIp());
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return decodeURIComponent(r.body.url.split('/pay/')[1]);
}
async function payCard(ref: string, ip: string) {
  const r = await routes.pay.POST(new Request(SITE + '/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ ref, token: 'tok' }) }));
  return { status: r.status, body: await r.json() };
}
async function payStatus(ref: string, ip: string) {
  const r = await routes.status.POST(new Request(SITE + '/api/pay/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ ref }) }));
  return { status: r.status, body: await r.json() };
}
async function back(ref: string, ip: string) {
  const r = await routes.ret.GET(new Request(SITE + '/shop/return/' + ref + '?payment_id=x&outcome=authorised', { headers: { 'X-Forwarded-For': ip } }), { params: Promise.resolve({ ref }) });
  return r.headers.get('x-next-page');
}
async function retry(ref: string, ip: string) {
  const r = await routes.retry.GET(new Request(SITE + '/shop/retry/' + ref, { headers: { 'X-Forwarded-For': ip } }), { params: Promise.resolve({ ref }) });
  return r.headers.get('location') || '';
}

describe.skipIf(!DB_URL)('rate limits on a database', function () {
  beforeAll(async function () {
    Object.assign(process.env, {
      ...dbEnv(DB_URL), SHOP_EVENT: EVENT, SHOP_CURRENCY: 'USD', SHOP_SITE_URL: SITE, SHOP_PUBLIC_URL: '', SHOP_ADMIN_KEY: ADMIN_KEY,
      MFA_ENCRYPTION_KEY: MFA_KEY, EMAIL_DRIVER: 'console', PREREG_NOTIFY_EMAIL: 'team@example.com', PREREG_SEND_CONFIRMATION: '0',
      IFZA_API_KEY: IFZA_KEY, IFZA_STORE: 'Elixium-Events-Test', IFZA_URL: await startStub(), IFZA_MAX_CALLS: '100000'
    });
    vi.spyOn(console, 'info').mockImplementation(function () {});
    vi.spyOn(console, 'error').mockImplementation(function () {});
    raw = mysql.createPool({ uri: DB_URL, connectionLimit: 3 });
    routes = {
      admin: await import('@/app/shop/admin/[...path]/route'),
      prereg: await import('@/app/api/preregister/route'),
      checkout: await import('@/app/api/checkout/route'),
      pay: await import('@/app/api/pay/route'),
      status: await import('@/app/api/pay/status/route'),
      ret: await import('@/app/shop/return/[ref]/route'),
      retry: await import('@/app/shop/retry/[ref]/route')
    };
    closeDb = (await import('@/lib/shop/db')).closeDb;
    // the seeded admin gets an authenticator for the test; its own settings come back afterwards
    adminSaved = (await q('SELECT id, mfa_enabled, mfa_secret_encrypted, mfa_enrolled_at, mfa_last_used_step FROM users WHERE email = ?', [ADMIN]))[0] || null;
    await q('UPDATE users SET mfa_enabled = 1, mfa_secret_encrypted = ?, mfa_last_used_step = NULL WHERE email = ?', [encryptTotpSecret(MFA_SECRET, MFA_KEY), ADMIN]);
    await forgetFailures('email:' + ADMIN);
  });

  afterAll(async function () {
    if (adminSaved) {
      await q('UPDATE users SET mfa_enabled = ?, mfa_secret_encrypted = ?, mfa_enrolled_at = ?, mfa_last_used_step = ? WHERE id = ?',
        [adminSaved.mfa_enabled, adminSaved.mfa_secret_encrypted, adminSaved.mfa_enrolled_at, adminSaved.mfa_last_used_step, adminSaved.id]);
    }
    await q("DELETE FROM shop_sign_in_failures WHERE bucket LIKE ? OR bucket = ? OR bucket LIKE 'ip:10.88.%'", ['email:shoptest+lim-%', 'email:' + ADMIN]);
    // audit_logs is append-only (the database refuses deletes): the test's entries (addresses 10.88.x.y) stay
    await q("DELETE FROM shop_orders WHERE email LIKE 'shoptest+lim-%@example.com'");
    await q("DELETE FROM pre_registrations WHERE email LIKE 'shoptest+lim-%@example.com'");
    // the pre-registration attempts of this run's addresses (stored as codes, made the site's way)
    const crypto = await import('node:crypto');
    const key = crypto.createHmac('sha256', ADMIN_KEY).update('cj300 preregister').digest();
    const hashes = usedIps.map(function (ip) { return crypto.createHmac('sha256', key).update(ip).digest('hex'); });
    usedKeys.push(...hashes.map(function (h) { return 'prereg:' + h; }));
    const buckets = usedKeys.map(function (k) { return crypto.createHash('sha256').update(k).digest('hex'); });
    await q('DELETE FROM shop_rate_limits WHERE bucket IN (?)', [buckets]);
    await closeDb();
    await raw.end();
    await new Promise(function (r) { stub.close(r); });
    vi.restoreAllMocks();
  });

  // ═══ Dashboard sign-in + MFA: 5 failures per email, 20 per address, 15 minutes ═══
  describe('dashboard sign-in', function () {
    it('5 wrong passwords for an email: the 6th try is refused, from any address', async function () {
      const who = mail('pw');
      for (let i = 0; i < 5; i++) expect((await signIn({ email: who, password: 'wrong', ip: freshIp() })).status).toBe(401);
      expect(await signIn({ email: who, password: 'wrong', ip: freshIp() })).toEqual({ status: 429, body: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
      // capitals are the same email
      expect((await signIn({ email: who.toUpperCase(), password: 'wrong', ip: freshIp() })).status).toBe(429);
      // another email is not affected
      expect((await signIn({ email: mail('pw-other'), password: 'wrong', ip: freshIp() })).status).toBe(401);
    });

    it('a locked email refuses even the right password and code', async function () {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) await signIn({ email: ADMIN, password: 'wrong', ip });
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip: freshIp() })).status).toBe(429);
      await forgetFailures('email:' + ADMIN);
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip: freshIp() })).status).toBe(200);
    });

    it('wrong MFA codes count as failures, and are written to the audit log', async function () {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: '000000', ip })).status).toBe(401);
      }
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip })).status).toBe(429);
      expect((await q("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'shop.dashboard_mfa_failed' AND ip_address = ?", [ip]))[0].n).toBe(5);
      await forgetFailures('email:' + ADMIN, 'ip:' + ip);
    });

    it('a code used once counts as a failure the second time', async function () {
      const ip = freshIp();
      const c = await code();
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: c, ip })).status).toBe(200);
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: c, ip })).status).toBe(401);
      expect((await q('SELECT COUNT(*) AS n FROM shop_sign_in_failures WHERE bucket = ?', ['ip:' + ip]))[0].n).toBe(1);
      await forgetFailures('email:' + ADMIN, 'ip:' + ip);
    });

    it('a missing code is not counted (the form asks for it), a right sign-in neither', async function () {
      const ip = freshIp();
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, ip })).status).toBe(401);
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip })).status).toBe(200);
      expect((await q('SELECT COUNT(*) AS n FROM shop_sign_in_failures WHERE bucket = ?', ['ip:' + ip]))[0].n).toBe(0);
    });

    it('20 failures from one address: every email is refused from there, other addresses still work', async function () {
      const ip = freshIp();
      for (let i = 0; i < 20; i++) expect((await signIn({ email: mail('ip' + i), password: 'wrong', ip })).status).toBe(401);
      expect((await signIn({ email: mail('ip-new'), password: 'wrong', ip })).status).toBe(429);
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip })).status).toBe(429);
      expect((await signIn({ email: ADMIN, password: ADMIN_PASSWORD, code: await code(), ip: freshIp() })).status).toBe(200);
    });

    it('the lock ends after 15 minutes', async function () {
      const who = mail('window');
      for (let i = 0; i < 5; i++) await signIn({ email: who, password: 'wrong', ip: freshIp() });
      expect((await signIn({ email: who, password: 'wrong', ip: freshIp() })).status).toBe(429);
      await q('UPDATE shop_sign_in_failures SET at = at - INTERVAL 16 MINUTE WHERE bucket = ?', ['email:' + who]);
      expect((await signIn({ email: who, password: 'wrong', ip: freshIp() })).status).toBe(401);
    });

    it('an unknown email and a wrong password get the same answer (no account guessing)', async function () {
      const a = await signIn({ email: mail('nobody'), password: 'wrong', ip: freshIp() });
      const b = await signIn({ email: ADMIN, password: 'wrong', ip: freshIp() });
      expect(a).toEqual(b);
      await forgetFailures('email:' + ADMIN);
    });

    // each try is written first and counted after, so tries at the same moment see each other
    it('30 wrong passwords at the same moment: no more than 5 are tried', async function () {
      const who = mail('race');
      const answers = await Promise.all(Array.from({ length: 30 }, function () { return signIn({ email: who, password: 'wrong', ip: freshIp() }); }));
      const tried = answers.filter(function (a) { return a.status === 401; }).length;
      expect(tried).toBeLessThanOrEqual(5);
      expect(answers.filter(function (a) { return a.status === 429; }).length).toBeGreaterThanOrEqual(25);
      // refused tries leave nothing behind: exactly the tried ones are counted
      expect((await q('SELECT COUNT(*) AS n FROM shop_sign_in_failures WHERE bucket = ?', ['email:' + who]))[0].n).toBe(tried);
    });
  });

  // ═══ Pre-registration: 5 per hour per connection ═══
  describe('pre-registration form', function () {
    it('5 per connection: the 6th is refused, another connection is not affected', async function () {
      const ip = freshIp(); usedIps.push(ip);
      for (let i = 0; i < 5; i++) expect((await preregister(goodForm(mail('reg' + i)), ip)).status).toBe(200);
      expect(await preregister(goodForm(mail('reg5')), ip)).toEqual({ status: 429, body: { ok: false, error: 'Too many attempts from this connection. Please try again in an hour.' } });
      expect((await q('SELECT COUNT(*) AS n FROM pre_registrations WHERE email = ?', [mail('reg5')]))[0].n).toBe(0);
      const other = freshIp(); usedIps.push(other);
      expect((await preregister(goodForm(mail('reg-other')), other)).status).toBe(200);
    });

    it('bots and invalid forms don\'t use up the limit', async function () {
      const ip = freshIp(); usedIps.push(ip);
      for (let i = 0; i < 6; i++) {
        expect((await preregister(Object.assign(goodForm(mail('bot' + i)), { website: 'spam' }), ip)).body).toEqual({ ok: true });
        expect((await preregister(Object.assign(goodForm(mail('fast' + i)), { started: String(Date.now()) }), ip)).body).toEqual({ ok: true });
        expect((await preregister(Object.assign(goodForm(mail('bad' + i)), { email: 'x' }), ip)).status).toBe(422);
      }
      expect((await preregister(goodForm(mail('after-bots')), ip)).status).toBe(200);
    });

    it('the same email from 5 connections is fine (the limit is per connection)', async function () {
      for (let i = 0; i < 5; i++) {
        const ip = freshIp(); usedIps.push(ip);
        expect((await preregister(goodForm(mail('same')), ip)).status).toBe(200);
      }
    });

    it('the limit ends after an hour', async function () {
      const ip = freshIp(); usedIps.push(ip);
      for (let i = 0; i < 5; i++) await preregister(goodForm(mail('hour' + i)), ip);
      expect((await preregister(goodForm(mail('hour5')), ip)).status).toBe(429);
      await q('UPDATE shop_rate_limits SET window_start = window_start - INTERVAL 61 MINUTE WHERE window_start > UTC_TIMESTAMP(3) - INTERVAL 10 MINUTE');
      expect((await preregister(goodForm(mail('hour6')), ip)).status).toBe(200);
    });

    // the connection is the LAST X-Forwarded-For entry (nginx's); a made-up first one changes nothing
    it('a blocked connection can\'t get past by sending its own X-Forwarded-For', async function () {
      const ip = freshIp(); usedIps.push(ip);
      for (let i = 0; i < 5; i++) await preregister(goodForm(mail('spoof' + i)), ip);
      const fake = freshIp(); usedIps.push(fake);
      // what nginx passes on: the visitor's made-up entry, then the real address
      expect((await preregister(goodForm(mail('spoof5')), fake + ', ' + ip)).status).toBe(429);
    });

    // counted atomically (lib/shop/limit.ts)
    it('10 submissions at the same moment: no more than 5 are saved', async function () {
      const ip = freshIp(); usedIps.push(ip);
      const answers = await Promise.all(Array.from({ length: 10 }, function (_, i) { return preregister(goodForm(mail('race' + i)), ip); }));
      expect(answers.filter(function (a) { return a.status === 200; }).length).toBe(5);
      expect(answers.filter(function (a) { return a.status === 429; }).length).toBe(5);
    });
  });

  // ═══ Checkout: 5 unpaid orders per email, 20 per address, 1 hour ═══
  describe('checkout', function () {
    it('5 unpaid orders per email: the 6th is refused, capitals count as the same email', async function () {
      const who = mail('co');
      for (let i = 0; i < 5; i++) {
        const r = await checkout(who, freshIp());
        expect(r.status, JSON.stringify(r.body)).toBe(200);
        expect(r.body.url).toMatch(/^http:\/\/site\.test\/pay\//);
      }
      expect(await checkout(who, freshIp())).toEqual({ status: 400, body: { error: UNFINISHED } });
      expect((await checkout(who.toUpperCase(), freshIp())).body.error).toBe(UNFINISHED);
      expect((await q('SELECT COUNT(*) AS n FROM shop_orders WHERE email = ?', [who]))[0].n).toBe(5);
      // another email is not affected
      expect((await checkout(mail('co-other'), freshIp())).status).toBe(200);
    });

    it('20 unpaid orders from one address: the 21st is refused, other addresses still work', async function () {
      const ip = freshIp();
      for (let i = 0; i < 20; i++) expect((await checkout(mail('coip' + i), ip)).status).toBe(200);
      expect((await checkout(mail('coip-new'), ip)).body.error).toBe(UNFINISHED);
      expect((await checkout(mail('coip-new'), freshIp())).status).toBe(200);
    });

    it('paid orders don\'t count', async function () {
      const who = mail('copaid');
      for (let i = 0; i < 5; i++) await checkout(who, freshIp());
      expect((await checkout(who, freshIp())).body.error).toBe(UNFINISHED);
      await q("UPDATE shop_orders SET status = 'paid' WHERE email = ?", [who]);
      expect((await checkout(who, freshIp())).status).toBe(200);
    });

    it('the limit ends after an hour', async function () {
      const who = mail('cohour');
      for (let i = 0; i < 5; i++) await checkout(who, freshIp());
      expect((await checkout(who, freshIp())).body.error).toBe(UNFINISHED);
      await q('UPDATE shop_orders SET created_at = created_at - INTERVAL 61 MINUTE WHERE email = ?', [who]);
      expect((await checkout(who, freshIp())).status).toBe(200);
    });

    it('10 orders for one email at the same moment: no more than 5 are made', async function () {
      const who = mail('corace');
      const answers = await Promise.all(Array.from({ length: 10 }, function () { return checkout(who, freshIp()); }));
      expect(answers.filter(function (a) { return a.status === 200; }).length).toBe(5);
      expect((await q('SELECT COUNT(*) AS n FROM shop_orders WHERE email = ?', [who]))[0].n).toBe(5);
    });

    // the address is the LAST X-Forwarded-For entry (nginx's)
    it('a blocked address can\'t get past by sending its own X-Forwarded-For', async function () {
      const ip = freshIp();
      for (let i = 0; i < 20; i++) await checkout(mail('cospoof' + i), ip);
      expect((await checkout(mail('cospoof-new'), freshIp() + ', ' + ip)).body.error).toBe(UNFINISHED);
    });
  });

  // ═══ Payment: the APIs that reach IFZA (its limit: 100 create + checkout calls per 15 minutes) ═══
  describe('payment', function () {
    it('/api/pay: 10 card tries per order in 30 minutes, then refused without asking IFZA', async function () {
      const ref = await newOrder('pay');
      usedKeys.push('pay:ref:' + ref);
      const before = ifzaCalls.checkout;
      for (let i = 0; i < 10; i++) {
        const ip = freshIp(); usedKeys.push('pay:ip:' + ip);
        expect((await payCard(ref, ip)).body).toEqual({ error: 'Please check your card details and try again.', retry: true });
      }
      const ip = freshIp(); usedKeys.push('pay:ip:' + ip);
      expect(await payCard(ref, ip)).toEqual({ status: 429, body: { error: TOO_MANY_PAY, retry: true } });
      expect(ifzaCalls.checkout - before).toBe(10);
    });

    it('/api/pay: 30 tries per address in 15 minutes, a made-up X-Forwarded-For changes nothing', async function () {
      const ip = freshIp(); usedKeys.push('pay:ip:' + ip);
      for (let i = 0; i < 30; i++) { const ref = 'CJNOPE' + STAMP + 'A' + i; usedKeys.push('pay:ref:' + ref); expect((await payCard(ref, ip)).status).toBe(404); }
      usedKeys.push('pay:ref:CJNOPE' + STAMP + 'X', 'pay:ref:CJNOPE' + STAMP + 'Y');
      expect((await payCard('CJNOPE' + STAMP + 'X', ip)).status).toBe(429);
      const fake = freshIp(); usedKeys.push('pay:ip:' + fake);
      expect((await payCard('CJNOPE' + STAMP + 'Y', fake + ', ' + ip)).status).toBe(429);
    });

    it('/api/pay/status: 20 per order in 15 minutes, then the pending page without asking IFZA', async function () {
      const ref = await newOrder('status');
      usedKeys.push('status:ref:' + ref);
      for (let i = 0; i < 20; i++) {
        const ip = freshIp(); usedKeys.push('status:ip:' + ip);
        expect((await payStatus(ref, ip)).status).toBe(200);
      }
      const before = ifzaCalls.status;
      const ip = freshIp(); usedKeys.push('status:ip:' + ip);
      expect(await payStatus(ref, ip)).toEqual({ status: 429, body: { page: SITE + '/payment/pending?orderid=' + ref } });
      expect(ifzaCalls.status).toBe(before);
    });

    it('/shop/return: 20 per order in 15 minutes, then the pending page without asking IFZA', async function () {
      const ref = await newOrder('ret');
      usedKeys.push('return:ref:' + ref);
      // a card sent, so the status is asked from IFZA
      await q('UPDATE shop_orders SET pay_checkout_at = NOW(3) WHERE ref = ?', [ref]);
      const before = ifzaCalls.status;
      for (let i = 0; i < 20; i++) {
        const ip = freshIp(); usedKeys.push('return:ip:' + ip);
        expect(await back(ref, ip)).toBe(SITE + '/payment/pending?orderid=' + ref);
      }
      expect(ifzaCalls.status - before).toBe(20);
      const ip = freshIp(); usedKeys.push('return:ip:' + ip);
      expect(await back(ref, ip)).toBe(SITE + '/payment/pending?orderid=' + ref);
      expect(ifzaCalls.status - before).toBe(20);
    });

    it('/shop/retry: the open retry is reused, at most 5 an hour per order, 20 per address', async function () {
      const ref = await newOrder('retry');
      const ip = freshIp(); usedKeys.push('retry:ip:' + ip);
      const first = await retry(ref, ip);
      expect(first).toMatch(/\/shop\/pay\//);
      // opened again while that order is open: the same order, no new one
      expect(await retry(ref, ip)).toBe(first);
      expect((await q('SELECT COUNT(*) AS n FROM shop_orders WHERE retry_of = ?', [ref]))[0].n).toBe(1);
      // once its card was sent, a new one; at most 5 an hour
      for (let i = 0; i < 6; i++) {
        await q("UPDATE shop_orders SET pay_checkout_at = NOW(3) WHERE retry_of = ?", [ref]);
        await retry(ref, ip);
      }
      expect((await q('SELECT COUNT(*) AS n FROM shop_orders WHERE retry_of = ?', [ref]))[0].n).toBe(5);
      await q("UPDATE shop_orders SET pay_checkout_at = NOW(3) WHERE retry_of = ?", [ref]);
      expect(await retry(ref, ip)).toBe(SITE + '/tickets');
      // the address: 20 an hour
      const other = freshIp(); usedKeys.push('retry:ip:' + other);
      for (let i = 0; i < 20; i++) await retry('CJNOPE' + STAMP, other);
      expect(await retry(ref, other)).toBe(SITE + '/tickets');
    });

    it('IFZA\'s calls: past this site\'s cap no payment is made, and the order can try again later', async function () {
      const crypto = await import('node:crypto');
      const cap = crypto.createHash('sha256').update('ifza:calls').digest('hex');
      await q('DELETE FROM shop_rate_limits WHERE bucket = ?', [cap]);
      process.env.IFZA_MAX_CALLS = '2';
      try {
        await newOrder('cap1');
        await newOrder('cap2');
        const before = ifzaCalls.create;
        const r = await checkout(mail('cap3'), freshIp());
        expect(r).toEqual({ status: 400, body: { error: 'Payment isn’t available for your order right now. You have not been charged. Please try again later.' } });
        expect(ifzaCalls.create).toBe(before);
        // not refused by IFZA: the order stays open, to be paid once the cap allows
        expect((await q('SELECT status FROM shop_orders WHERE email = ?', [mail('cap3')]))[0].status).toBe('pending');
      } finally {
        process.env.IFZA_MAX_CALLS = '100000';
        await q('DELETE FROM shop_rate_limits WHERE bucket = ?', [cap]);
      }
    });
  });
});
