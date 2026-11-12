/*
 * Card payments through IFZA's payment API (IFZA's gateway is Telr), with IFZA_API_KEY / IFZA_STORE.
 * Guide: "IFZA Card Payments · Integration Guide" (base https://world.ifza.com). Three calls, all a
 * JSON POST from this server with the key in X-Api-Key (never in the browser):
 *
 *   1. create  POST /api/integrations/v1/payments           → payment_id, telr_init (card fields)
 *   2. checkout POST /api/integrations/v1/payments/checkout → order_url (the bank's 3-D Secure step)
 *   3. status  POST /api/integrations/v1/payments/status    → PAID, CREATED, PENDING, ON_HOLD,
 *                                                              DECLINED, CANCELLED or EXPIRED
 *
 * The card itself goes from Telr's card fields on our /pay page straight to Telr (a one-time token
 * comes back): it never reaches this server. A payment expires after 30 minutes and is checked out
 * once; its reference (our order ref) can be used only once.
 * IFZA has no notification of its own: the buyer's return and the sweep (orders.ts) ask the status.
 */
import { shopConfig as config } from './config';

const PATH = '/api/integrations/v1/payments';

// IFZA's JSON, as it comes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = any;

// the init settings of Telr's card fields (telrSdk.init), passed through as IFZA gives them
export type TelrInit = Record<string, unknown>;

export function configured(): boolean {
  return !!(config.ifza.apiKey && config.ifza.store);
}

// { status, body } of a call; null when IFZA can't be reached
async function request(path: string, payload: unknown): Promise<{ status: number; body: Answer } | null> {
  try {
    const r = await fetch(config.ifza.url + PATH + path, {
      method: 'POST',
      headers: { 'X-Api-Key': config.ifza.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000)
    });
    const text = await r.text();
    let body: Answer;
    try {
      body = JSON.parse(text);
    } catch {
      body = { ok: false, error: 'not_json', message: text.slice(0, 500) };
    }
    return { status: r.status, body };
  } catch (e) {
    console.error('[shop] ifza request failed:', (e as Error).message);
    return null;
  }
}

function money(n: unknown): string {
  return Number(n).toFixed(2);
}

// what went wrong, for the log (IFZA's error code and details, never the key)
export function describe(r: { status: number; body: Answer } | null): string {
  if (!r) return 'IFZA unreachable';
  const b = r.body || {};
  if (b.error === 'not_json') return r.status + ' not IFZA\'s API answering (a firewall or proxy page): ' + String(b.message || '').replace(/<style[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return r.status + ' ' + String(b.error || '') + (b.message ? ': ' + b.message : '') + (b.issues ? ' ' + JSON.stringify(b.issues) : '');
}

export type Customer = { firstName: string; lastName: string; email: string; phone: string; address1: string; city: string; country: string };

/*
 * 4.1 Create payment: { id, expiresAt, init, response } or { id: null, response, code } when IFZA
 * refused it (code: IFZA's error code, '' when unreachable).
 */
export async function createPayment(p: { reference: string; amount: unknown; currency: string; description: string; returnUrl: string; customer: Customer }) {
  const r = await request('', {
    store: config.ifza.store,
    amount: Number(money(p.amount)),
    currency: p.currency,
    reference: p.reference,
    description: String(p.description).slice(0, 63),
    return_url: p.returnUrl,
    customer: p.customer
  });
  const b = r && r.body;
  if (r && r.status === 200 && b && b.ok && b.payment_id && b.telr_init) {
    return { id: String(b.payment_id), expiresAt: String(b.expires_at || ''), init: b.telr_init as TelrInit, response: b as Answer, code: '' };
  }
  return { id: null, expiresAt: '', init: null, response: (r ? { status: r.status, body: b } : null) as Answer, code: b ? String(b.error || '') : '', why: describe(r) };
}

/*
 * 4.2 Checkout with the card token: { orderUrl } or { orderUrl: null, status, code, message } (status
 * 0 when IFZA can't be reached). message is the gateway's for a refused card (502 telr_error).
 */
export async function checkout(paymentId: string, cardToken: string) {
  const r = await request('/checkout', { payment_id: paymentId, card_token: cardToken });
  const b = (r && r.body) || {};
  if (r && r.status === 200 && b.ok && typeof b.order_url === 'string' && /^https:\/\//.test(b.order_url)) {
    return { orderUrl: b.order_url as string, status: 200, code: '', message: '', why: '' };
  }
  return { orderUrl: null, status: r ? r.status : 0, code: String(b.error || ''), message: String(b.message || ''), why: describe(r) };
}

/*
 * 4.3 Payment status: { status, paid, response }, null when IFZA can't be asked now (unreachable,
 * rate limited, 409 verification_failed: "don't fulfil"). paid is only true for PAID of our
 * reference, amount and currency.
 */
export async function paymentStatus(order: { ref: string; pay_id: string; amount: unknown; currency: string }) {
  const r = await request('/status', { payment_id: order.pay_id });
  const b = r && r.body;
  if (!r || r.status !== 200 || !b || !b.ok || typeof b.status !== 'string') {
    console.error('[shop] ifza status ' + order.ref + ': ' + describe(r));
    return null;
  }
  const status = b.status.toUpperCase();
  const paid = status === 'PAID' &&
    String(b.reference || '') === order.ref &&
    String(b.payment_id || '') === order.pay_id &&
    money(b.amount || 0) === money(order.amount) &&
    String(b.currency || '').toUpperCase() === String(order.currency).toUpperCase();
  if (status === 'PAID' && !paid) {
    console.error('[shop] ifza status ' + order.ref + ': PAID at IFZA but not accepted, the payment differs from our order');
  }
  return { status, paid, response: b as Answer };
}
