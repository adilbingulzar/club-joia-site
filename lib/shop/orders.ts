/*
 * The ticket shop: event, prices and stock for the site, orders, Telr payment and what follows.
 * The HTTP side is in app/Api/Eventsnew (the calls lib/alfred.ts makes, the same answers as
 * Alfred's ticket API) and app/shop (payment link, Telr's return and advice, retry).
 *
 * The event id is the event's slug (SHOP_EVENT), the ticket ids are the products' (products.ts).
 * An order's status is only ever taken from Telr's check, never from a request.
 */
import { shopConfig as config } from './config';
import { db, humanCode, transaction, type Db } from './db';
import { product, products, type Product } from './products';
import * as telr from './telr';
import { fulfil } from './fulfil';
import { notPaidEmail } from './email';

export class BuyerError extends Error {}

export type OrderItemRow = { productId: string; name: string; price: number; quantity: number; tier: string; codes: string[] };
export type Buyer = {
  firstName: string; lastName: string; email: string; address: string; zipcode: string; city: string;
  country: string; gender: string; birthday: string; mobile: string; ip: string;
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

// tickets taken of each product: paid, and unpaid ones still on their way to Telr
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
    if (!telr.configured()) throw new BuyerError('Online payment isn’t set up yet. Please contact us to complete your booking.');
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

// Same origin and "/ticketing_" in the path: the site's checkout takes it as "no payment page"
// (paymentPage in app/api/checkout). A buyer opening it lands on the declined page.
function noPaymentPage(ref: string): string {
  return config.publicUrl + '/shop/ticketing_error?orderid=' + encodeURIComponent(ref);
}

// the site's page after payment
export function sitePage(status: string, ref: string): string {
  const page = status === 'paid' ? '/thank-you' : '/payment/' + status;
  return config.siteUrl + page + '?orderid=' + encodeURIComponent(ref);
}

// The payment link (/shop/pay/<ref>): makes the Telr order once, the address to send the buyer
// to; null for an unknown order
export async function payUrl(ref: string): Promise<string | null> {
  return transaction(async function (c) {
    const o = (await c.query('SELECT * FROM shop.orders WHERE ref = $1 FOR UPDATE', [ref])).rows[0];
    if (!o) return null;
    if (o.status === 'paid') return sitePage('paid', ref);
    if (o.status !== 'pending') return noPaymentPage(ref);
    if (o.telr_url) return o.telr_url as string;

    const created = await telr.createOrder({
      cartId: o.ref,
      amount: o.amount,
      currency: o.currency,
      description: 'Club JOIA 300 tickets ' + o.ref,
      returnUrl: config.publicUrl + '/shop/telr/return/' + encodeURIComponent(o.ref)
    });
    await c.query(
      "UPDATE shop.orders SET telr_ref = $2, telr_url = $3, telr_create = $4, status = CASE WHEN $3 IS NULL THEN 'failed' ELSE status END, updated_at = NOW(3) WHERE id = $1",
      [o.id, created.ref, created.url, JSON.stringify(created.response)]
    );
    if (!created.url) {
      console.error('[shop] telr create ' + o.ref + ' refused:', JSON.stringify(created.response));
      return noPaymentPage(ref);
    }
    return created.url;
  });
}

/*
 * The order's status from Telr: 'paid' (and fulfilled), 'pending', 'denied' or 'cancel' for the
 * site's pages, null for an unknown order.
 */
export async function settle(ref: string): Promise<string | null> {
  const o = (await db.query('SELECT * FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return null;
  if (o.fulfilled_at) return 'paid';
  if (!o.telr_ref) return 'cancel';

  const status = o.status === 'paid'
    ? { code: telr.STATUS.PAID, paid: true, response: null }
    : await telr.checkOrder({ ref: o.ref, telr_ref: o.telr_ref, amount: o.amount, currency: o.currency });
  if (!status) return 'pending'; // Telr can't be asked now: its advice can still settle it

  let next = o.status;
  if (status.paid) next = 'paid';
  else if (status.code === telr.STATUS.DECLINED) next = 'declined';
  else if (status.code === telr.STATUS.CANCELLED || status.code === telr.STATUS.EXPIRED) next = 'cancelled';

  if (status.response) {
    await db.query(
      "UPDATE shop.orders SET status = $2, telr_status = $3, telr_check = $4, paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, NOW(3)) ELSE paid_at END, updated_at = NOW(3) WHERE id = $1 AND status <> 'paid'",
      [o.id, next, status.code, JSON.stringify(status.response)]
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
 * today's prices (Telr takes each cart once), then its payment link. Paid already: the thank-you
 * page; a ticket off sale or sold out: the alternative payment page. null for an unknown order.
 */
export async function retryUrl(ref: string): Promise<string | null> {
  const o = (await db.query('SELECT * FROM shop.orders WHERE ref = $1', [ref])).rows[0];
  if (!o) return null;
  const done = (await db.query(
    "SELECT ref FROM shop.orders WHERE (ref = $1 OR retry_of = $1) AND status = 'paid' LIMIT 1", [o.ref]
  )).rows[0];
  if (done) return sitePage('paid', done.ref);
  if (!telr.configured()) return config.altPaymentUrl;

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

// Telr's transaction advice (tran_cartid): the HTTP status to answer, anything but 200 makes Telr
// send it again
export async function advice(cartId: string): Promise<number> {
  const ref = text(cartId, 63);
  if (!ref) return 400;
  return (await settle(ref)) ? 200 : 503;
}
