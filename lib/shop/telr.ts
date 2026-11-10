/*
 * Telr hosted payment page, on the store in TELR_STORE_ID / TELR_AUTH_KEY.
 *
 * Docs: https://docs.telr.com/reference/payment-page (create) and
 * https://docs.telr.com/reference/check-status-1 (check). Both are a JSON POST to order.json with
 * the store id and authentication key in the body. The key is in Telr's merchant dashboard:
 * Integrations > Hosted Payment Page > Request Authentication. The store must accept SHOP_CURRENCY,
 * else Telr answers E05.
 */
import { shopConfig as config } from './config';

// order.status.code of a check
export const STATUS = {
  PENDING: 1,
  AUTHORISED: 2, // not captured: an AUTH, or a SALE placed on hold
  PAID: 3,
  PAYMENT_REQUESTED: 4,
  EXPIRED: -1,
  CANCELLED: -2,
  DECLINED: -3,
  REPLACED: -4
};

// Telr's JSON, as it comes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = any;

export function configured(): boolean {
  return !!(config.telr.storeId && config.telr.authKey);
}

// Telr's decoded answer, null when it can't be reached
async function request(payload: unknown): Promise<Answer | null> {
  try {
    const r = await fetch(config.telr.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000)
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: { message: 'not JSON', note: text.slice(0, 500) } };
    }
  } catch (e) {
    console.error('[shop] telr request failed:', (e as Error).message);
    return null;
  }
}

function money(n: unknown): string {
  return Number(n).toFixed(2);
}

/*
 * Creates the Telr order: { ref, url, response }, url null when Telr refused it.
 * cartId must be unique (Telr refuses a second one, E56) and at most 63 characters. Telr sends
 * the buyer to returnUrl whether the payment was authorised, declined or cancelled.
 */
export async function createOrder(o: { cartId: string; amount: unknown; currency: string; description: string; returnUrl: string }) {
  const response = await request({
    method: 'create',
    store: Number(config.telr.storeId),
    authkey: config.telr.authKey,
    framed: 0,
    order: {
      cartid: o.cartId,
      test: config.telr.test ? '1' : '0',
      amount: money(o.amount),
      currency: o.currency,
      description: String(o.description).slice(0, 63),
      trantype: 'sale'
    },
    return: { authorised: o.returnUrl, declined: o.returnUrl, cancelled: o.returnUrl }
  });
  const order = response && response.order;
  return {
    ref: order && order.ref ? String(order.ref) : null,
    url: order && order.ref && order.url ? String(order.url) : null,
    response: response as Answer
  };
}

/*
 * The order's status at Telr: { code, paid, response }, null when Telr can't be asked.
 * paid is only true for a captured payment of our cart, amount and currency, and never for a
 * test payment on a live store.
 */
export async function checkOrder(order: { ref: string; telr_ref: string; amount: unknown; currency: string }) {
  const response = await request({
    method: 'check',
    store: Number(config.telr.storeId),
    authkey: config.telr.authKey,
    order: { ref: order.telr_ref }
  });
  const o = response && response.order;
  if (!o || !o.status || o.status.code === undefined) return null;

  const code = Number(o.status.code);
  const paid = code === STATUS.PAID &&
    String(o.cartid || '') === order.ref &&
    money(o.amount || 0) === money(order.amount) &&
    String(o.currency || '').toUpperCase() === String(order.currency).toUpperCase() &&
    (Number(o.test || 0) === 0 || config.telr.test);

  if (code === STATUS.PAID && !paid) {
    console.error('[shop] telr check ' + order.ref + ': paid at Telr but not accepted, the order differs from ours or is a test payment on a live store');
  }
  return { code, paid, response: response as Answer };
}
