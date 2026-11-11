import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSession, signSession, SESSION_SECONDS } from '@/lib/admin/session';
import { backendQuery, pageQuery, previousPeriod, readFilters } from '@/lib/admin/filters';
import { revenueSeries } from '@/lib/admin/series';
import { ordersCsv } from '@/lib/admin/csv';
import { change, compact, percent } from '@/lib/admin/format';
import type { OrderRow } from '@/lib/admin/backend';

const USER = { id: 'cmuser1', email: 'admin@joia.test', name: 'Joia Admin', role: 'SUPER_ADMIN' };
// 9 Nov 2026, 10:00 in Dubai
const NOW = new Date('2026-11-09T06:00:00Z');

beforeEach(function () { vi.stubEnv('SHOP_ADMIN_KEY', 'test-admin-key-0123456789'); });
afterEach(function () { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('admin session', function () {
  it('reads back what it signed', function () {
    expect(readSession(signSession(USER, NOW.getTime()), NOW.getTime())).toEqual(USER);
  });

  it('refuses a changed, expired or missing cookie', function () {
    const token = signSession(USER, NOW.getTime());
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ u: { ...USER, id: 'other' }, exp: 9999999999 })).toString('base64url');
    expect(readSession(forged + '.' + sig, NOW.getTime())).toBeNull();
    expect(readSession(payload + '.x' + sig.slice(1), NOW.getTime())).toBeNull();
    expect(readSession(token, NOW.getTime() + SESSION_SECONDS * 1000 + 1000)).toBeNull();
    expect(readSession(undefined)).toBeNull();
    expect(readSession('nonsense')).toBeNull();
  });

  it('is invalid under another key, and can’t be made without one', function () {
    const token = signSession(USER, NOW.getTime());
    vi.stubEnv('SHOP_ADMIN_KEY', 'another-admin-key-0123456789');
    expect(readSession(token, NOW.getTime())).toBeNull();
    vi.stubEnv('SHOP_ADMIN_KEY', '');
    expect(function () { signSession(USER); }).toThrow();
    expect(readSession(token, NOW.getTime())).toBeNull();
  });
});

describe('admin filters', function () {
  it('turns a preset into Dubai days', function () {
    expect(readFilters({ range: '7d' }, NOW)).toMatchObject({ range: '7d', from: '2026-11-03', to: '2026-11-09' });
    expect(readFilters({ range: 'today' }, NOW)).toMatchObject({ from: '2026-11-09', to: '2026-11-09' });
    // 23:30 on 9 Nov UTC is already 10 Nov in Dubai
    expect(readFilters({ range: 'today' }, new Date('2026-11-09T23:30:00Z'))).toMatchObject({ from: '2026-11-10' });
  });

  it('takes custom dates, in order, also without "Custom dates" picked', function () {
    expect(readFilters({ range: 'custom', from: '2026-11-05', to: '2026-11-01' }, NOW)).toMatchObject({ range: 'custom', from: '2026-11-01', to: '2026-11-05' });
    expect(readFilters({ from: '2026-11-01' }, NOW)).toMatchObject({ range: 'custom', from: '2026-11-01', to: '' });
    expect(readFilters({ range: 'custom', from: 'nope' }, NOW)).toMatchObject({ range: 'all', from: '', to: '' });
    expect(readFilters({ range: 'yesterday', page: '-3' }, NOW)).toMatchObject({ range: 'all', page: 1 });
  });

  it('compares with the period just before', function () {
    expect(previousPeriod(readFilters({ range: '7d' }, NOW))).toEqual({ from: '2026-10-27', to: '2026-11-02' });
    expect(previousPeriod(readFilters({}, NOW))).toBeNull();
  });

  it('builds the backend’s query and the page links', function () {
    const f = readFilters({ range: '30d', status: 'paid', tier: 'ruby-red', q: 'ali', page: '2' }, NOW);
    expect(backendQuery(f, { page: 2, perPage: 25 })).toBe('from=2026-10-11&to=2026-11-09&status=paid&tier=ruby-red&q=ali&page=2&perPage=25');
    expect(pageQuery(f)).toBe('?range=30d&status=paid&tier=ruby-red&q=ali&page=2');
    expect(pageQuery(f, { status: '', page: 1 })).toBe('?range=30d&tier=ruby-red&q=ali');
    expect(pageQuery(readFilters({ from: '2026-11-01', to: '2026-11-02' }, NOW))).toBe('?range=custom&from=2026-11-01&to=2026-11-02');
  });
});

describe('admin revenue series', function () {
  it('has every day of the range, empty ones at zero', function () {
    const s = revenueSeries([{ day: '2026-11-03', revenue: 8000, paid: 1, orders: 2 }], '2026-11-02', '2026-11-04', NOW);
    expect(s.map(function (b) { return [b.key, b.revenue, b.orders]; })).toEqual([['2026-11-02', 0, 0], ['2026-11-03', 8000, 2], ['2026-11-04', 0, 0]]);
  });

  it('runs from the first order to today without a range, in weeks past 92 days', function () {
    const s = revenueSeries([{ day: '2026-11-01', revenue: 1, paid: 1, orders: 1 }], '', '', NOW);
    expect(s.length).toBe(9);
    const long = revenueSeries([{ day: '2026-01-01', revenue: 5, paid: 1, orders: 1 }, { day: '2026-01-07', revenue: 5, paid: 1, orders: 1 }], '2026-01-01', '2026-11-09', NOW);
    expect(long[0]).toMatchObject({ from: '2026-01-01', to: '2026-01-07', revenue: 10 });
    expect(long[long.length - 1].to).toBe('2026-11-09');
  });
});

describe('admin formats', function () {
  it('shows figures as the charts need them', function () {
    expect(compact(8000)).toBe('8,000');
    expect(compact(25000)).toBe('25K');
    expect(compact(1500000)).toBe('1.5M');
    expect(percent(1, 3)).toBe('33%');
    expect(percent(0, 0)).toBe('0%');
    expect(change(120, 100)).toEqual({ text: '+20%', up: true });
    expect(change(50, 100)).toEqual({ text: '−50%', up: false });
    expect(change(5, 0)).toBeNull();
  });
});

describe('admin CSV', function () {
  it('quotes what needs it and keeps formulas out of Excel', function () {
    const order: OrderRow = {
      ref: 'CJ1', status: 'paid', createdAt: '2026-11-09T06:00:00Z', paidAt: '2026-11-09T06:05:00Z',
      buyer: { name: '=HYPERLINK("x")', email: 'a@b.co', mobile: '+92 300', country: 'pakistan' },
      items: [{ productId: 'ruby-red/3-days', name: 'Ruby Red, 3 days', quantity: 2, price: 8000 }],
      amount: 16000, currency: 'USD', tickets: 8, error: null
    };
    const lines = ordersCsv([order]).replace('﻿', '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"9 Nov 2026, 10:00",CJ1,Paid,"\'=HYPERLINK(""x"")",a@b.co,\'+92 300,pakistan,"2 × Ruby Red, 3 days",2,16000,USD,"9 Nov 2026, 10:05",8,');
  });
});

describe('admin backend calls', function () {
  type Reply = { status: number; body: unknown };
  const seen: { request: Request; path: string }[] = [];

  // lib/admin/backend with the shop's admin API (lib/shop/admin) answering reply()
  async function backend(reply: () => Reply | Promise<Reply>) {
    seen.length = 0;
    vi.resetModules();
    vi.doMock('@/lib/shop/admin', function () {
      return { adminApi: async function (request: Request, path: string) { seen.push({ request, path }); return reply(); } };
    });
    return import('@/lib/admin/backend');
  }

  beforeEach(function () { vi.spyOn(console, 'error').mockImplementation(function () {}); });
  afterEach(function () { vi.doUnmock('@/lib/shop/admin'); });

  it('sends the key and the signed-in staff member', async function () {
    const { adminGet } = await backend(function () { return { status: 200, body: { ok: 1 } }; });
    expect(await adminGet('stats?from=2026-11-01', USER)).toEqual({ ok: 1 });
    expect(seen[0].path).toBe('stats');
    expect(new URL(seen[0].request.url).searchParams.get('from')).toBe('2026-11-01');
    expect(seen[0].request.headers.get('authorization')).toBe('Bearer test-admin-key-0123456789');
    expect(seen[0].request.headers.get('x-admin-user')).toBe('cmuser1');
  });

  it('signs out on 401, finds nothing on 404, fails otherwise', async function () {
    let status = 401;
    const { adminGet, SignedOut } = await backend(function () { return { status, body: {} }; });
    await expect(adminGet('stats', USER)).rejects.toBeInstanceOf(SignedOut);
    status = 404;
    expect(await adminGet('orders/X', USER)).toBeNull();
    expect(seen[1].path).toBe('orders/X');
    status = 500;
    await expect(adminGet('stats', USER)).rejects.toThrow('500');
  });

  it('signs in through the API and passes its messages on', async function () {
    let reply: () => Reply | Promise<Reply> = function () { return { status: 200, body: { user: USER } }; };
    const { adminLogin } = await backend(function () { return reply(); });
    expect(await adminLogin('admin@joia.test', 'pw', '123456', '1.2.3.4')).toEqual({ user: USER });
    expect(seen[0].path).toBe('login');
    expect(await seen[0].request.json()).toEqual({ email: 'admin@joia.test', password: 'pw', code: '123456', ip: '1.2.3.4' });
    reply = function () { return { status: 401, body: { error: 'Email or password is incorrect.' } }; };
    expect(await adminLogin('admin@joia.test', 'bad', '123456', '1.2.3.4')).toEqual({ error: 'Email or password is incorrect.' });
    reply = function () { return { status: 403, body: { error: 'Set up two-factor sign-in first.' } }; };
    expect(await adminLogin('admin@joia.test', 'pw', '123456', '1.2.3.4')).toEqual({ error: 'Set up two-factor sign-in first.' });
    reply = function () { throw new Error('down'); };
    expect((await adminLogin('admin@joia.test', 'pw', '123456', '1.2.3.4')).error).toMatch(/isn’t available/);
  });
});
