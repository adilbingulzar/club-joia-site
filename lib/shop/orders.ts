/*
 * The ticket shop: event, prices and stock for the site, orders, payment (IFZA, lib/shop/ifza.ts)
 * and what follows. The site's pages call these functions directly (lib/catalog.ts, app/api/checkout,
 * app/pay, app/api/pay); an HTTP side is in app/Api/Eventsnew (the same answers as Alfred's ticket
 * API) and app/shop (payment link, the bank check's return, retry).
 *
 * The event id is the event's slug (SHOP_EVENT), the ticket ids are the products' (products.ts).
 * An order's status is only ever taken from IFZA's payment status, never from a request.
 */
import { shopConfig as config } from './config';
import { db, humanCode, transaction, type Db } from './db';
import { product, products, type Product } from './products';
import * as ifza from './ifza';
import { countries } from '../countries';
import { fulfil } from './fulfil';
import { notPaidEmail } from './email';

export class BuyerError extends Error {}

export type OrderItemRow = { productId: string; name: string; price: number; quantity: number; tier: string; codes: string[] };
export type Buyer = {
  firstName: string; lastName: string; email: string; address: string; zipcode: string; city: string;
  country: string; countryCode?: string; gender: string; birthday: string; mobile: string; ip: string;
};

// Unpaid orders (not paid, made in the last hour) one email or one address may have, so nobody can
// fill the orders or send "One more step to join us" to someone else's email over and over.
const UNPAID_PER_EMAIL = 5;
const UNPAID_PER_IP = 20;

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

type SaleEvent = { id: string; slug: string; name: string; start_date: string; end_date: string };

// The event on sale, null when SHOP_EVENT isn't set or the event isn't published
async function saleEvent(): Promise<SaleEvent | null> {
  if (!config.event) return null;
  // dates as text (db.ts: dateStrings), never shifted by a time zone
  const r = await db.query<SaleEvent>(
    "SELECT id, slug, name, start_date, end_date FROM events WHERE slug = $1 AND status IN ('PUBLISHED', 'LIVE')",
    [config.event]
  );
  return r.rows[0] || null;
}

// tickets taken of each product: paid, and unpaid ones still being paid for
async function taken(client: Db, eventId: string): Promise<Record<string, number>> {
  const r = await client.query(
    `SELECT i.product_id AS id, SUM(i.quantity) AS n
     FROM shop.orders o,
       JSON_TABLE(o.items, '$[*]' COLUMNS (product_id VARCHAR(100) PATH '$.productId', quantity INT PATH '$.quantity')) i
     WHERE o.event_id = $1 AND (o.status = 'paid' OR (o.status = 'pending' AND o.created_at > NOW(3) - INTERVAL $2 MINUTE))
     GROUP BY i.product_id`,
    [eventId, config.holdMinutes]
  );
  const out: Record<string, number> = {};
  r.rows.forEach(function (row) { out[row.id] = Number(row.n); });
  return out;
}

function left(p: Product, takenOf: Record<string, number>): number {
  return p.stock === null ? 1000 : Math.max(0, p.stock - (takenOf[p.id] || 0));
}

// ─── The site's calls (Api/Eventsnew/...) ───

// buyTicketsEvents: [{ id, eventname, eventCurrency, StartDate, EndDate }]
export async function events() {
  const e = await saleEvent();
  return e ? [{ id: e.slug, eventname: e.name, eventCurrency: config.currency.toLowerCase(), StartDate: e.start_date, EndDate: e.end_date }] : [];
}

// buyTicketsTicketTypes: [{ id, ticketDescription, ticketPrice, softDelete, ticketVisible }]
export async function ticketTypes(eventId: string) {
  const e = await saleEvent();
  if (!e || eventId !== e.slug) return [];
  return products.map(function (p) {
    return { id: p.id, eventId: e.slug, ticketDescription: p.name, ticketPrice: p.price.toFixed(2), softDelete: '0', ticketVisible: p.visible ? '1' : '0' };
  });
}

// buyTicketsSoldOut: { left_tickets }
export async function soldOut(ticketId: string) {
  const e = await saleEvent();
  const p = product(ticketId);
  if (!e || !p) return { left_tickets: 0 };
  return { left_tickets: left(p, await taken(db, e.id)) };
}

function readOrder(body: Record<string, string>): { buyer: Buyer; items: OrderItemRow[] } {
  const code = text(body.countryPhoneCode, 6).replace(/[^\d]/g, '');
  const phone = text(body.phoneNumber, 20).replace(/[^\d]/g, '');
  const buyer: Buyer = {
    firstName: text(body.name), lastName: text(body.surname),
    email: text(body.email, 150).toLowerCase(),
    address: text(body.address, 200), zipcode: text(body.zipcode, 20), city: text(body.city), country: text(body.country, 60),
    // ISO 3166 code (the site sends it), for the payment's billing address
    countryCode: text(body.countryCode, 2).toUpperCase(),
    gender: text(body.gender, 10), birthday: text(body.age, 10),
    mobile: phone ? (code ? '+' + code + ' ' : '') + phone : '',
    ip: text(body.ip, 60)
  };
  if (!buyer.firstName || !buyer.lastName) throw new BuyerError('Please fill in your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new BuyerError('Please enter a valid email address.');

  // tickets[i][ticketId], tickets[i][quantity]
  const lines: Record<string, { ticketId?: string; quantity?: string }> = {};
  Object.keys(body).forEach(function (k) {
    const m = /^tickets\[(\d+)\]\[(ticketId|quantity)\]$/.exec(k);
    if (m) (lines[m[1]] = lines[m[1]] || {})[m[2] as 'ticketId' | 'quantity'] = body[k];
  });
  const items: OrderItemRow[] = [];
  Object.keys(lines).slice(0, products.length).forEach(function (i) {
    const p = product(String(lines[i].ticketId));
    const quantity = Number(lines[i].quantity);
    if (!p) throw new BuyerError('Your order has a ticket that isn’t available. Please review your tickets.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > config.maxPerTicket) throw new BuyerError('Please choose between 1 and ' + config.maxPerTicket + ' of ' + p.name + '.');
    const same = items.find(function (it) { return it.productId === p.id; });
    if (same) { same.quantity += quantity; return; }
    items.push({ productId: p.id, name: p.name, price: p.price, quantity, tier: p.tier, codes: p.codes });
  });
  if (!items.length) throw new BuyerError('Your order is empty.');
  return { buyer, items };
}

// one order at a time past the stock check, so the last tickets aren't sold twice (until commit)
async function lockStock(c: Db): Promise<void> {
  await c.query("SELECT name FROM shop.locks WHERE name = 'stock' FOR UPDATE");
}

function newRef(): string {
  return 'CJ' + Date.now().toString(36).toUpperCase() + humanCode(6);
}

function payLink(ref: string): string {
  return config.publicUrl + '/shop/pay/' + encodeURIComponent(ref);
}

// buyTickets: { status: '1', paymentUrl, orderId } or { status: '0', message } for the buyer
export async function buyTickets(body: Record<string, string>) {
  try {
    if (!ifza.configured()) throw new BuyerError('Online payment isn’t set up yet. Please contact us to complete your booking.');
    const e = await saleEvent();
    if (!e) throw new BuyerError('Tickets aren’t on sale at the moment.');
    const order = readOrder(body);
    const amount = order.items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);

    const ref = await transaction(async function (c) {
      await lockStock(c);
      const unpaid = async function (column: 'email' | 'ip', value: string) {
        if (!value) return 0;
        const r = await c.query(
          "SELECT COUNT(*) AS n FROM shop.orders WHERE " + column + " = $1 AND status <> 'paid' AND created_at > NOW(3) - INTERVAL 1 HOUR",
          [value]
        );
        return Number(r.rows[0].n);
      };
      if (await unpaid('email', order.buyer.email) >= UNPAID_PER_EMAIL || await unpaid('ip', order.buyer.ip) >= UNPAID_PER_IP) {
        throw new BuyerError('You have several unfinished orders. Please complete one of them or try again in an hour.');
      }
      const t = await taken(c, e.id);
      order.items.forEach(function (i) {
        const l = left(product(i.productId)!, t);
        if (l < i.quantity) throw new BuyerError(l ? 'Only ' + l + ' of ' + i.name + ' left.' : i.name + ' is sold out.');
      });
      const r = newRef();
      await c.query(
        'INSERT INTO shop.orders (ref, event_id, email, ip, buyer, items, amount, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [r, e.id, order.buyer.email, order.buyer.ip, JSON.stringify(order.buyer), JSON.stringify(order.items), amount.toFixed(2), config.currency]
      );
      return r;
    });

    console.info('[shop] order ' + ref + ': ' + amount.toFixed(2) + ' ' + config.currency + ', ' + order.items.map(function (i) { return i.quantity + ' x ' + i.name; }).join(', '));
    return { status: '1', paymentUrl: payLink(ref), orderId: ref };
  } catch (err) {
    if (err instanceof BuyerError) return { status: '0', message: err.message };
    throw err;
  }
}

// ─── Payment ───
//
// The buyer pays on this site's /pay/<ref> page (app/pay): Telr's card fields there, from the IFZA
// payment made for the order (preparePayment), then the card token goes to IFZA (payWithCard) and
// the bank's check opens in a frame. It returns to /shop/return/<ref> (app/shop/return), which asks
// IFZA for the status (settle). Card details never reach this server.

// Same origin and "/ticketing_" in the path: a buyer opening it lands on the declined page.
function noPaymentPage(ref: string): string {
  return config.publicUrl + '/shop/ticketing_error?orderid=' + encodeURIComponent(ref);
}

// the site's page after payment
export function sitePage(status: string, ref: string): string {
  const page = status === 'paid' ? '/thank-you' : '/payment/' + status;
  return config.siteUrl + page + '?orderid=' + encodeURIComponent(ref);
}

// the site's page for an order that can't be paid (any more)
function closedPage(o: { status: string; ref: string }): string {
  if (o.status === 'paid') return sitePage('paid', o.ref);
  if (o.status === 'cancelled') return sitePage('cancel', o.ref);
  return sitePage('denied', o.ref);
}

// the payment page of an order
export function payPage(ref: string): string {
  return config.siteUrl + '/pay/' + encodeURIComponent(ref);
}

// where the bank check sends the buyer back (on IFZA's registered return domain)
function returnUrl(ref: string): string {
  return config.publicUrl + '/shop/return/' + encodeURIComponent(ref);
}

// The payment link (/shop/pay/<ref>): the address to send the buyer to; null for an unknown order
export async function payUrl(ref: string): Promise<string | null> {
  const o = (await db.query('SELECT ref, status FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return null;
  if (o.status === 'paid') return sitePage('paid', ref);
  if (o.status !== 'pending') return noPaymentPage(ref);
  return payPage(ref);
}

// the billing address IFZA needs (the card network requires address1, city and an ISO country)
function customer(b: Buyer): ifza.Customer {
  let code = String(b.countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    const byName = countries.find(function (c) { return c.name.toLowerCase() === String(b.country || '').toLowerCase(); });
    code = byName ? byName.code : '';
  }
  return {
    firstName: b.firstName, lastName: b.lastName, email: b.email,
    phone: String(b.mobile || '').replace(/[^\d+]/g, ''),
    address1: b.address, city: b.city, country: code
  };
}

// a time from IFZA as MySQL DATETIME text (UTC), 30 minutes from now if it can't be read
function datetime(iso: string): string {
  const d = new Date(iso);
  const t = isNaN(d.getTime()) ? new Date(Date.now() + 30 * 60000) : d;
  return t.toISOString().replace('T', ' ').replace('Z', '');
}

export type PayState =
  | { state: 'ready'; ref: string; amount: number; currency: string; items: OrderItemRow[]; init: ifza.TelrInit }
  // nothing to pay here: the site's page to show instead
  | { state: 'done'; page: string }
  // the order's half hour is over (its tickets aren't held any more): a new order is needed
  | { state: 'expired'; ref: string }
  | { state: 'error'; message: string };

const UNAVAILABLE = 'Payment isn’t available for your order right now. You have not been charged. Please try again later.';

/*
 * The payment of an order, for the /pay page: makes the IFZA payment once (the checkout also does,
 * so a refusal shows on the form), or the page to go to instead. null for an unknown order.
 */
export async function preparePayment(ref: string): Promise<PayState | null> {
  const r = await transaction(async function (c): Promise<PayState | 'settle' | null> {
    const o = (await c.query(
      'SELECT *, (pay_expires_at > NOW(3) + INTERVAL 1 MINUTE) AS pay_open, (created_at > NOW(3) - INTERVAL $2 MINUTE) AS held FROM shop.orders WHERE ref = $1 FOR UPDATE',
      [ref, config.holdMinutes]
    )).rows[0];
    if (!o) return null;
    if (o.status !== 'pending') return { state: 'done', page: closedPage(o) };
    // the card was sent already: its outcome decides
    if (o.pay_checkout_at) return 'settle';
    const ready = function (init: ifza.TelrInit): PayState {
      return { state: 'ready', ref: o.ref, amount: Number(o.amount), currency: o.currency, items: o.items, init };
    };
    if (o.pay_id) return Number(o.pay_open) ? ready(o.pay_init) : { state: 'expired', ref: o.ref };
    if (!Number(o.held)) return { state: 'expired', ref: o.ref };
    if (!ifza.configured()) return { state: 'error', message: UNAVAILABLE };

    const created = await ifza.createPayment({
      reference: o.ref,
      amount: o.amount,
      currency: o.currency,
      description: 'Club JOIA 300 tickets ' + o.ref,
      returnUrl: returnUrl(o.ref),
      customer: customer(o.buyer)
    });
    if (!created.id) {
      console.error('[shop] ifza create ' + o.ref + ' refused: ' + created.why);
      // IFZA's own refusal (a 4xx with its JSON error): this order can't be paid; IFZA down, busy, or
      // a firewall/proxy page in front of it (not JSON): it can be tried again
      const status = created.response && created.response.status;
      const refused = status >= 400 && status < 500 && status !== 429 && !!created.code && created.code !== 'not_json';
      await c.query(
        "UPDATE shop.orders SET pay_create = $2, status = CASE WHEN $3 THEN 'failed' ELSE status END, updated_at = NOW(3) WHERE id = $1",
        [o.id, JSON.stringify(created.response), refused]
      );
      return { state: 'error', message: UNAVAILABLE };
    }
    await c.query(
      "UPDATE shop.orders SET pay_id = $2, pay_status = 'CREATED', pay_init = $3, pay_expires_at = $4, pay_create = $5, updated_at = NOW(3) WHERE id = $1",
      [o.id, created.id, JSON.stringify(created.init), datetime(created.expiresAt), JSON.stringify(created.response)]
    );
    return ready(created.init);
  });
  if (r !== 'settle') return r;
  const status = await settle(ref);
  return { state: 'done', page: sitePage(status || 'pending', ref) };
}

export type CardResult =
  // show the bank's check (3-D Secure) in a frame
  | { orderUrl: string }
  // go to this page (the payment is decided, or being decided)
  | { page: string }
  // tell the buyer; retry: the same card form can be used again
  | { error: string; retry: boolean };

/*
 * The buyer's card token (from Telr's card fields) for the order's IFZA payment: checks it out,
 * once per payment. Answers the bank's check, or where to go.
 */
export async function payWithCard(ref: string, cardToken: string): Promise<CardResult | null> {
  const r = await transaction(async function (c): Promise<CardResult | 'declined' | 'settle' | null> {
    const o = (await c.query(
      'SELECT *, (pay_expires_at > NOW(3)) AS pay_open FROM shop.orders WHERE ref = $1 FOR UPDATE', [ref]
    )).rows[0];
    if (!o) return null;
    if (o.status !== 'pending') return { page: closedPage(o) };
    if (o.pay_checkout_at) return 'settle';
    if (!o.pay_id || !Number(o.pay_open)) {
      return { error: 'This payment has expired. Please start again: you have not been charged.', retry: false };
    }

    const out = await ifza.checkout(o.pay_id, cardToken);
    if (out.orderUrl) {
      await c.query("UPDATE shop.orders SET pay_checkout_at = NOW(3), pay_status = 'CHECKED_OUT', updated_at = NOW(3) WHERE id = $1", [o.id]);
      console.info('[shop] order ' + o.ref + ': card sent, bank check');
      return { orderUrl: out.orderUrl };
    }
    console.error('[shop] ifza checkout ' + o.ref + ': ' + out.why);
    // checked out already (by a request we lost the answer of): its status decides
    if (out.code === 'already_checked_out') {
      await c.query('UPDATE shop.orders SET pay_checkout_at = NOW(3), updated_at = NOW(3) WHERE id = $1', [o.id]);
      return 'settle';
    }
    // the gateway refused the card: this payment is used up
    if (out.status === 502 && out.code === 'telr_error') {
      await c.query(
        "UPDATE shop.orders SET pay_checkout_at = NOW(3), pay_status = 'REFUSED', pay_check = $2, status = 'declined', updated_at = NOW(3) WHERE id = $1",
        [o.id, JSON.stringify({ error: out.code, message: out.message })]
      );
      return 'declined';
    }
    if (out.code === 'validation_error') return { error: 'Please check your card details and try again.', retry: true };
    if (out.code === 'expired') return { error: 'This payment has expired. Please start again: you have not been charged.', retry: false };
    // IFZA unreachable, busy or not set up: nothing was charged, the same card form can try again
    return { error: 'We couldn’t reach the payment service. You have not been charged. Please try again in a moment.', retry: true };
  });
  if (r === null || typeof r === 'object') return r;
  if (r === 'declined') {
    const o = (await db.query('SELECT id FROM shop.orders WHERE ref = $1', [ref])).rows[0];
    if (o) await sendNotPaid(o.id).catch(function (e) { console.error('[shop] order ' + ref + ' not-paid email:', e); });
    return { page: sitePage('denied', ref) };
  }
  return { page: sitePage((await settle(ref)) || 'pending', ref) };
}

/*
 * The order's status from IFZA: 'paid' (and fulfilled), 'pending', 'denied' or 'cancel' for the
 * site's pages, null for an unknown order.
 */
export async function settle(ref: string): Promise<string | null> {
  const o = (await db.query('SELECT * FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return null;
  if (o.fulfilled_at) return 'paid';
  if (!o.pay_id) return o.status === 'pending' ? 'cancel' : (o.status === 'paid' ? 'paid' : 'denied');

  const status = o.status === 'paid'
    ? { status: 'PAID', paid: true, response: null }
    : await ifza.paymentStatus({ ref: o.ref, pay_id: o.pay_id, amount: o.amount, currency: o.currency });
  if (!status) return o.status === 'declined' ? 'denied' : 'pending'; // IFZA can't be asked now: the sweep tries again

  let next = o.status;
  if (status.paid) next = 'paid';
  else if (status.status === 'DECLINED') next = 'declined';
  else if (status.status === 'CANCELLED' || status.status === 'EXPIRED') next = 'cancelled';

  if (status.response) {
    await db.query(
      "UPDATE shop.orders SET status = $2, pay_status = $3, pay_check = $4, paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, NOW(3)) ELSE paid_at END, updated_at = NOW(3) WHERE id = $1 AND status <> 'paid'",
      [o.id, next, status.status, JSON.stringify(status.response)]
    );
  }
  if (next === 'paid') {
    console.info('[shop] order ' + ref + ' paid');
    await fulfil(o.id).catch(function (e) { console.error('[shop] order ' + ref + ' paid but not fulfilled:', e); });
    return 'paid';
  }
  if (next === 'declined' || next === 'cancelled') {
    await sendNotPaid(o.id).catch(function (e) { console.error('[shop] order ' + ref + ' not-paid email:', e); });
  }
  if (next === 'declined') return 'denied';
  if (next === 'cancelled') return 'cancel';
  return 'pending';
}

// "One more step to join us", once per order, with a link that starts a new payment for its tickets
async function sendNotPaid(orderId: number): Promise<void> {
  const marked = await db.query(
    "UPDATE shop.orders SET failed_email_at = NOW(3) WHERE id = $1 AND failed_email_at IS NULL AND status IN ('declined', 'cancelled')",
    [orderId]
  );
  if (!marked.affectedRows) return;
  const o = (await db.query('SELECT * FROM shop.orders WHERE id = $1', [orderId])).rows[0];
  if (!o) return;
  const event = (await db.query(
    'SELECT name, metadata, start_date AS start_day, end_date AS end_day FROM events WHERE id = $1',
    [o.event_id]
  )).rows[0] || {};
  await notPaidEmail(o.buyer.email, {
    eventName: event.name || '',
    eventStart: event.start_day,
    eventEnd: event.end_day,
    items: o.items,
    phone: config.supportPhone(event),
    payUrl: config.publicUrl + '/shop/retry/' + encodeURIComponent(o.ref),
    altUrl: config.altPaymentUrl
  });
}

/*
 * "Complete your payment" in that email (/shop/retry/<ref>): a new order for the same tickets at
 * today's prices (IFZA takes each reference once), then its payment link. The link opened again
 * while that new order is still open (its half hour) gives the same order, not another one, and an
 * order gets at most 5 retries an hour: a link opened over and over can't fill the orders, hold
 * the tickets or use up IFZA's calls. Paid already: the thank-you
 * page; a ticket off sale or sold out: the alternative payment page. null for an unknown order.
 */
export async function retryUrl(ref: string): Promise<string | null> {
  const o = (await db.query('SELECT * FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return null;
  const done = (await db.query(
    "SELECT ref FROM shop.orders WHERE (ref = $1 OR retry_of = $1) AND status = 'paid' LIMIT 1", [o.ref]
  )).rows[0];
  if (done) return sitePage('paid', done.ref);
  if (!ifza.configured()) return config.altPaymentUrl;
  const root = o.retry_of || o.ref;
  const open = (await db.query(
    "SELECT ref FROM shop.orders WHERE retry_of = $1 AND status = 'pending' AND pay_checkout_at IS NULL AND created_at > NOW(3) - INTERVAL $2 MINUTE ORDER BY id DESC LIMIT 1",
    [root, config.holdMinutes]
  )).rows[0];
  if (open) return payLink(open.ref);
  const lastHour = Number((await db.query(
    'SELECT COUNT(*) AS n FROM shop.orders WHERE retry_of = $1 AND created_at > NOW(3) - INTERVAL 1 HOUR', [root]
  )).rows[0].n);
  if (lastHour >= 5) return config.altPaymentUrl;

  const items: OrderItemRow[] = [];
  for (const i of o.items as OrderItemRow[]) {
    const p = product(i.productId);
    if (!p) return config.altPaymentUrl;
    items.push({ productId: p.id, name: p.name, price: p.price, quantity: i.quantity, tier: p.tier, codes: p.codes });
  }
  const amount = items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  const next = await transaction(async function (c) {
    await lockStock(c);
    const t = await taken(c, o.event_id);
    if (items.some(function (i) { return left(product(i.productId)!, t) < i.quantity; })) return null;
    const r = newRef();
    await c.query(
      'INSERT INTO shop.orders (ref, event_id, email, ip, buyer, items, amount, currency, retry_of) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [r, o.event_id, o.email, o.ip, JSON.stringify(o.buyer), JSON.stringify(items), amount.toFixed(2), config.currency, o.retry_of || o.ref]
    );
    return r;
  });
  if (!next) return config.altPaymentUrl;
  console.info('[shop] order ' + next + ': retry of ' + o.ref);
  return payLink(next);
}

/*
 * IFZA sends no notification: a buyer who paid but closed the page before the return would stay
 * unpaid. Every few minutes (instrumentation.ts) this asks IFZA about orders whose card was sent and
 * that aren't decided yet (also ON_HOLD ones), for a week. The number of orders asked.
 */
export async function sweep(limit = 20): Promise<number> {
  if (!ifza.configured()) return 0;
  const rows = (await db.query(
    `SELECT ref FROM shop.orders
     WHERE status = 'pending' AND pay_checkout_at IS NOT NULL
       AND pay_checkout_at > NOW(3) - INTERVAL 7 DAY AND updated_at < NOW(3) - INTERVAL 2 MINUTE
     ORDER BY updated_at LIMIT ` + Math.max(1, Math.min(100, Math.floor(limit))),
    []
  )).rows;
  for (const r of rows) {
    // touched first, so an order IFZA can't answer for waits its turn
    await db.query('UPDATE shop.orders SET updated_at = NOW(3) WHERE ref = $1', [r.ref]);
    await settle(r.ref).catch(function (e) { console.error('[shop] sweep ' + r.ref + ':', e); });
  }
  return rows.length;
}
