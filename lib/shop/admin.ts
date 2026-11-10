/*
 * Admin API of the sales dashboard (/admin, lib/admin/backend.ts), read only: app/shop/admin.
 *
 * Only this site's server calls it: every request carries SHOP_ADMIN_KEY as a bearer token, and
 * every request but the login names the signed-in staff member (X-Admin-User), who must still be
 * an active admin of the members app. Staff sign in with their members app email and password.
 *
 *   POST /shop/admin/login           { email, password, ip }  -> { user } or 401 { error }
 *   GET  /shop/admin/stats?<filters>                          -> figures and chart data
 *   GET  /shop/admin/orders?<filters>&page&perPage            -> { total, orders }
 *   GET  /shop/admin/orders/<ref>                             -> { order }
 *
 * Filters: from, to (YYYY-MM-DD in SHOP_TIMEZONE, the order's date), status, product, tier,
 * country, q (order ref, name, email or phone).
 */
import { verify } from '@node-rs/argon2';
import { shopConfig as config } from './config';
import { cuid, db } from './db';
import { hasShopKey, shopKey } from './key';
import { products } from './products';

const ROLES = ['ADMIN', 'SUPER_ADMIN'];
const STATUSES = ['pending', 'paid', 'declined', 'cancelled', 'failed'];

export type Answer = { status: number; body: unknown };

function answer(status: number, body: unknown): Answer {
  return { status, body };
}

// failed sign-ins (shop.sign_in_failures, so restarts and several servers count together):
// 5 per email and 20 per address in 15 minutes
async function tooMany(key: string, max: number): Promise<boolean> {
  const r = await db.query('SELECT COUNT(*) AS n FROM shop.sign_in_failures WHERE bucket = $1 AND at > NOW(3) - INTERVAL 15 MINUTE', [key]);
  return Number(r.rows[0].n) >= max;
}
async function failed(keys: string[]): Promise<void> {
  await db.query('INSERT INTO shop.sign_in_failures (bucket) VALUES ' + keys.map(function (_, i) { return '($' + (i + 1) + ')'; }).join(', '), keys);
  // the old ones aren't needed any more
  await db.query('DELETE FROM shop.sign_in_failures WHERE at < NOW(3) - INTERVAL 1 DAY');
}


async function login(request: Request): Promise<Answer> {
  const body = await request.json().catch(function () { return {}; }) as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase().slice(0, 150);
  const password = String(body.password || '').slice(0, 200);
  const ip = String(body.ip || 'unknown').slice(0, 60);
  if (!email || !password) return answer(400, { error: 'Enter your email and password.' });
  if (await tooMany('email:' + email, 5) || await tooMany('ip:' + ip, 20)) {
    return answer(429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
  }

  const user = (await db.query('SELECT id, email, name, role, status, password_hash FROM users WHERE email = $1', [email])).rows[0];
  // the members app's Argon2id hashes
  const ok = user && user.password_hash && await verify(user.password_hash, password).catch(function () { return false; });
  if (!ok || user.status !== 'ACTIVE' || ROLES.indexOf(user.role) < 0) {
    await failed(['email:' + email, 'ip:' + ip]);
    // the same answer for a wrong password, an unknown email or a non-admin account
    return answer(401, { error: 'Email or password is incorrect, or this account has no access to sales.' });
  }
  await db.query(
    'INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
    [cuid(), user.id, 'shop.dashboard_sign_in', 'user', user.id, ip === 'unknown' ? null : ip]
  );
  return answer(200, { user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

// the signed-in staff member, still an active admin
async function staff(request: Request) {
  const id = String(request.headers.get('x-admin-user') || '');
  if (!id) return null;
  const u = (await db.query('SELECT id, role, status FROM users WHERE id = $1', [id])).rows[0];
  return u && u.status === 'ACTIVE' && ROLES.indexOf(u.role) >= 0 ? u : null;
}

function date(v: string | null): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
}

// minutes the time zone is ahead of UTC at that moment
function zoneOffset(at: Date, timeZone: string): number {
  const p: Record<string, number> = {};
  new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at).forEach(function (x) { if (x.type !== 'literal') p[x.type] = Number(x.value); });
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

// the moment a day (YYYY-MM-DD) starts in SHOP_TIMEZONE, plus some days
function dayStart(day: string, plusDays = 0): Date {
  const utc = new Date(day + 'T00:00:00Z');
  utc.setUTCDate(utc.getUTCDate() + plusDays);
  let at = new Date(utc.getTime() - zoneOffset(utc, config.timezone) * 60000);
  at = new Date(utc.getTime() - zoneOffset(at, config.timezone) * 60000); // across a clock change
  return at;
}

// the day (YYYY-MM-DD) of a moment in SHOP_TIMEZONE
function dayOf(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

// "united arab emirates" -> "United Arab Emirates", as the dashboard groups countries
function initcap(s: string): string {
  return String(s || '').toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, function (_, a, b) { return a + b.toUpperCase(); });
}

// the items of an order o as rows i (product_id, tier, quantity, price, codes)
const ITEMS = "JSON_TABLE(o.items, '$[*]' COLUMNS (product_id VARCHAR(100) PATH '$.productId', tier VARCHAR(50) PATH '$.tier', " +
  "quantity INT PATH '$.quantity', price DECIMAL(12,2) PATH '$.price', codes JSON PATH '$.codes')) i";

// SQL conditions on shop.orders o for the filters, and on an item i of it (product, tier)
function filters(query: URLSearchParams) {
  const params: unknown[] = [];
  const where = ['1 = 1'];
  const items: string[] = [];
  const add = function (v: unknown) { params.push(v); return '$' + params.length; };
  const from = date(query.get('from'));
  const to = date(query.get('to'));
  if (from) where.push('o.created_at >= ' + add(dayStart(from)));
  if (to) where.push('o.created_at < ' + add(dayStart(to, 1)));
  const status = query.get('status');
  if (status && STATUSES.indexOf(status) >= 0) where.push('o.status = ' + add(status));
  const product = query.get('product');
  if (product && products.some(function (p) { return p.id === product; })) {
    where.push('JSON_CONTAINS(o.items, ' + add(JSON.stringify([{ productId: product }])) + ')');
    items.push('i.product_id = ' + add(product));
  }
  const tier = query.get('tier');
  if (tier && products.some(function (p) { return p.tier === tier; })) {
    where.push('JSON_CONTAINS(o.items, ' + add(JSON.stringify([{ tier }])) + ')');
    items.push('i.tier = ' + add(tier));
  }
  const country = String(query.get('country') || '').trim();
  // JSON text compares case-sensitively (utf8mb4_bin): both sides lower case
  if (country) where.push("LOWER(o.buyer->>'$.country') = LOWER(" + add(country) + ')');
  const q = String(query.get('q') || '').trim().slice(0, 100);
  if (q) {
    const like = add('%' + q.toLowerCase().replace(/[\\%_]/g, function (c) { return '\\' + c; }) + '%');
    where.push('(LOWER(o.ref) LIKE ' + like + ' OR o.email LIKE ' + like +
      " OR LOWER(CONCAT(o.buyer->>'$.firstName', ' ', o.buyer->>'$.lastName')) LIKE " + like + " OR o.buyer->>'$.mobile' LIKE " + like + ')');
  }
  return {
    params,
    where: 'WHERE ' + where.join(' AND '),
    items: items.length ? ' AND ' + items.join(' AND ') : ''
  };
}

function num(v: unknown): number {
  return Number(v) || 0;
}

async function stats(query: URLSearchParams): Promise<Answer> {
  const f = filters(query);
  const paidItems = 'FROM shop.orders o, ' + ITEMS + ' ' + f.where + " AND o.status = 'paid'" + f.items;
  const run = function (sql: string) { return db.query(sql, f.params).then(function (r) { return r.rows; }); };

  const [totals, tickets, days, byProduct, byTier, byStatus, countryRows, byType, countryList] = await Promise.all([
    run(`SELECT COUNT(*) AS orders, SUM(o.status = 'paid') AS paid,
           COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.amount END), 0) AS revenue,
           COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN o.email END) AS buyers
         FROM shop.orders o ${f.where}`),
    run(`SELECT COALESCE(SUM(i.quantity), 0) AS tickets ${paidItems}`),
    // per day in SHOP_TIMEZONE, counted below (the server may have no time zone tables)
    run(`SELECT o.created_at, o.status, o.amount FROM shop.orders o ${f.where}`),
    run(`SELECT i.product_id AS id, SUM(i.quantity) AS tickets, SUM(i.quantity * i.price) AS revenue ${paidItems} GROUP BY i.product_id`),
    run(`SELECT i.tier AS tier, SUM(i.quantity) AS tickets, SUM(i.quantity * i.price) AS revenue ${paidItems} GROUP BY i.tier`),
    run(`SELECT o.status, COUNT(*) AS orders, COALESCE(SUM(o.amount), 0) AS amount FROM shop.orders o ${f.where} GROUP BY o.status`),
    run(`SELECT LOWER(o.buyer->>'$.country') AS country, COUNT(*) AS orders, SUM(o.amount) AS revenue
         FROM shop.orders o ${f.where} AND o.status = 'paid' GROUP BY 1`),
    run(`SELECT c.code, SUM(i.quantity) AS tickets
         ${paidItems.replace(ITEMS, function () { return ITEMS + ", JSON_TABLE(i.codes, '$[*]' COLUMNS (code VARCHAR(20) PATH '$')) c"; })} GROUP BY c.code`),
    db.query("SELECT DISTINCT LOWER(buyer->>'$.country') AS country FROM shop.orders WHERE buyer->>'$.country' <> ''").then(function (r) { return r.rows; })
  ]);

  const dayOfRow: Record<string, { day: string; revenue: number; paid: number; orders: number }> = {};
  days.forEach(function (o) {
    const day = dayOf(new Date(o.created_at));
    const d = dayOfRow[day] ||= { day, revenue: 0, paid: 0, orders: 0 };
    d.orders++;
    if (o.status === 'paid') { d.paid++; d.revenue = Math.round((d.revenue + num(o.amount)) * 100) / 100; }
  });
  const byDay = Object.values(dayOfRow).sort(function (a, b) { return a.day < b.day ? -1 : 1; });
  const byCountry = countryRows.map(function (c) { return { country: initcap(c.country), orders: c.orders, revenue: c.revenue }; })
    .sort(function (a, b) { return num(b.revenue) - num(a.revenue) || (a.country < b.country ? -1 : 1); });
  const countries = Array.from(new Set(countryList.map(function (c) { return initcap(c.country); }))).sort()
    .map(function (country) { return { country }; });

  const typeNames: Record<string, string> = {};
  if (byType.length) {
    // the newest ticket type of each code names it
    (await db.query('SELECT code, name FROM ticket_types WHERE code IN ($1) ORDER BY created_at', [byType.map(function (t) { return t.code; })])).rows
      .forEach(function (t) { typeNames[t.code] = t.name; });
  }
  const tierNames: Record<string, string> = {};
  (await db.query('SELECT slug, display_name FROM membership_tiers ORDER BY sort_order')).rows
    .forEach(function (t) { tierNames[t.slug] = t.display_name; });

  const t = totals[0];
  const paid = num(t.paid);
  const revenue = num(t.revenue);
  const statusOf: Record<string, { orders: number; amount: number }> = {};
  byStatus.forEach(function (s) { statusOf[s.status] = { orders: num(s.orders), amount: num(s.amount) }; });
  const productOf: Record<string, { tickets?: unknown; revenue?: unknown }> = {};
  byProduct.forEach(function (p) { productOf[p.id] = p; });
  const tierOf: Record<string, { tickets?: unknown; revenue?: unknown }> = {};
  byTier.forEach(function (p) { tierOf[p.tier] = p; });
  const tierSlugs = Array.from(new Set(products.map(function (p) { return p.tier; })));

  return answer(200, {
    currency: config.currency,
    timezone: config.timezone,
    totals: {
      revenue,
      orders: num(t.orders),
      paid,
      buyers: num(t.buyers),
      tickets: num(tickets[0].tickets),
      average: paid ? Math.round((revenue / paid) * 100) / 100 : 0
    },
    byStatus: STATUSES.map(function (s) { return { status: s, orders: (statusOf[s] || { orders: 0 }).orders, amount: (statusOf[s] || { amount: 0 }).amount }; }),
    byDay,
    byProduct: products.map(function (p) {
      const s = productOf[p.id] || {};
      return { id: p.id, name: p.name, tier: p.tier, price: p.price, visible: p.visible, tickets: num(s.tickets), revenue: num(s.revenue) };
    }),
    byTier: tierSlugs.map(function (slug) {
      const s = tierOf[slug] || {};
      return { tier: slug, name: tierNames[slug] || slug, tickets: num(s.tickets), revenue: num(s.revenue) };
    }),
    byCountry: byCountry.map(function (c) { return { country: c.country, orders: num(c.orders), revenue: num(c.revenue) }; }),
    byTicketType: byType.map(function (x) { return { code: x.code, name: typeNames[x.code] || x.code, tickets: num(x.tickets) }; })
      .sort(function (a, b) { return b.tickets - a.tickets; }),
    options: {
      statuses: STATUSES,
      products: products.map(function (p) { return { id: p.id, name: p.name }; }),
      tiers: tierSlugs.map(function (slug) { return { id: slug, name: tierNames[slug] || slug }; }),
      countries: countries.map(function (c) { return c.country; })
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listRow(o: any) {
  return {
    ref: o.ref,
    status: o.status,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    buyer: { name: (o.buyer.firstName + ' ' + o.buyer.lastName).trim(), email: o.buyer.email, mobile: o.buyer.mobile || '', country: o.buyer.country || '' } as Record<string, unknown>,
    items: o.items.map(function (i: { productId: string; name: string; quantity: number; price: number }) { return { productId: i.productId, name: i.name, quantity: i.quantity, price: i.price }; }),
    amount: num(o.amount),
    currency: o.currency,
    tickets: o.tickets ? o.tickets.length : 0,
    error: o.error || null
  };
}

async function orders(query: URLSearchParams): Promise<Answer> {
  const f = filters(query);
  const perPage = Math.min(Math.max(parseInt(query.get('perPage') || '', 10) || 25, 1), 10000);
  const page = Math.max(parseInt(query.get('page') || '', 10) || 1, 1);
  const [count, rows] = await Promise.all([
    db.query('SELECT COUNT(*) AS n FROM shop.orders o ' + f.where, f.params),
    db.query('SELECT o.* FROM shop.orders o ' + f.where + ' ORDER BY o.created_at DESC, o.id DESC LIMIT ' + perPage + ' OFFSET ' + ((page - 1) * perPage), f.params)
  ]);
  return answer(200, { total: num(count.rows[0].n), page, perPage, orders: rows.rows.map(listRow) });
}

async function order(ref: string): Promise<Answer> {
  const o = (await db.query('SELECT * FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return answer(404, { error: 'Order not found' });
  const member = o.member_id
    ? (await db.query(
      `SELECT m.membership_number, u.email, u.status AS account, t.display_name AS tier, ms.status AS membership
       FROM members m JOIN users u ON u.id = m.user_id
       LEFT JOIN memberships ms ON ms.id = (SELECT x.id FROM memberships x WHERE x.member_id = m.id ORDER BY x.issue_date DESC LIMIT 1)
       LEFT JOIN membership_tiers t ON t.id = ms.tier_id WHERE m.id = $1`, [o.member_id])).rows[0] || null
    : null;
  const tickets = o.tickets && o.tickets.length
    ? (await db.query(
      'SELECT t.ticket_number AS number, tt.code, tt.name, t.status FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE t.ticket_number IN ($1) ORDER BY t.created_at, t.ticket_number',
      [o.tickets])).rows
    : [];
  const row = listRow(o);
  row.buyer = Object.assign({}, o.buyer, { name: row.buyer.name });
  return answer(200, {
    order: Object.assign(row, {
      items: o.items,
      fulfilledAt: o.fulfilled_at,
      updatedAt: o.updated_at,
      telr: { ref: o.telr_ref, status: o.telr_status },
      member: member ? { number: member.membership_number, email: member.email, account: member.account, tier: member.tier, membership: member.membership } : null,
      ticketList: tickets
    })
  });
}

// the pre-registrations (lib/preregister.ts), newest first, with q searching name, email, phone, country
async function registrations(query: URLSearchParams): Promise<Answer> {
  const q = String(query.get('q') || '').trim().slice(0, 100);
  const like = q ? '%' + q.replace(/[\\%_]/g, function (c) { return '\\' + c; }) + '%' : null;
  // the columns ignore case (utf8mb4_unicode_ci)
  const where = "WHERE $1 IS NULL OR email LIKE $1 OR CONCAT(first_name, ' ', last_name) LIKE $1 OR phone LIKE $1 OR country LIKE $1";
  const [rows, tiers] = await Promise.all([
    db.query('SELECT * FROM pre_registrations ' + where + ' ORDER BY created_at DESC, id DESC LIMIT 10000', [like]),
    db.query('SELECT tier_interest AS tier, COUNT(*) AS n FROM pre_registrations GROUP BY tier_interest', [])
  ]);
  return answer(200, {
    total: tiers.rows.reduce(function (s, t) { return s + Number(t.n); }, 0),
    byTier: Object.fromEntries(tiers.rows.map(function (t) { return [t.tier, Number(t.n)]; })),
    registrations: rows.rows.map(function (r) {
      return {
        createdAt: r.created_at, updatedAt: r.updated_at, firstName: r.first_name, lastName: r.last_name, email: r.email,
        phone: r.phone, country: r.country, tier: r.tier_interest, source: r.source || '', message: r.message || '', marketing: !!r.marketing_opt_in
      };
    })
  });
}

// What /shop/admin/<path> answers: path is "login", "stats", "orders", "orders/<ref>" or "registrations"
export async function adminApi(request: Request, path: string): Promise<Answer> {
  if (!shopKey()) return answer(503, { error: 'SHOP_ADMIN_KEY is not set' });
  if (!hasShopKey(request)) return answer(401, { error: 'Not authorised' });
  if (path === 'login') return request.method === 'POST' ? login(request) : answer(405, { error: 'Method not allowed' });
  if (request.method !== 'GET') return answer(405, { error: 'Method not allowed' });
  if (!(await staff(request))) return answer(401, { error: 'Signed out' });
  const query = new URL(request.url).searchParams;
  if (path === 'stats') return stats(query);
  if (path === 'orders') return orders(query);
  if (path === 'registrations') return registrations(query);
  const m = /^orders\/([^/]+)$/.exec(path);
  if (m) return order(m[1]);
  return answer(404, { error: 'Not found' });
}
