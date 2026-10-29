/*
 * Server side calls to Alfred, shared by app/api/checkout and app/api/checkout/methods.
 * Alfred has no CORS headers, so the browser can't call it directly.
 */
export const ALFRED_URL = (process.env.ALFRED_URL || '').replace(/\/+$/, '');
export const EVENT_ID = process.env.ALFRED_EVENT_ID || '';
export const VENDOR_ID = process.env.ALFRED_VENDOR_ID || '';

export async function alfred(path: string, data: Record<string, string>, timeoutMs = 20000) {
  const r = await fetch(ALFRED_URL + '/' + path, {
    method: 'POST',
    body: new URLSearchParams(data),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error('Alfred ' + path + ': HTTP ' + r.status);
  return r.json();
}

// How the buyer pays on the gateway's page (credit card, iDEAL, PayPal, ...).
export type Method = { id: string; name: string; icon: string };

// Alfred's names are lowercase ("ideal payment"), these read better on the form.
const NAMES: Record<string, string> = {
  'credit card payment': 'Credit card',
  'ideal payment': 'iDEAL',
  'bancontact payment': 'Bancontact',
  'giro payment': 'Giropay',
  'payconiq payment': 'Payconiq',
  'my bank': 'MyBank'
};

// Pay.nl buyers pay the way usual in their country (the Pay.nl service may not take cards in USD).
const PAYNL_METHODS: Record<string, string> = { NL: 'ideal payment', BE: 'bancontact payment' };

// The methods the gateway offers for the event, as Alfred's own shop lists them.
export async function paymentMethods(engine: string): Promise<(Method & { alfredName: string })[]> {
  const res = await alfred('Api/Eventsnew/buyTicketsPaymentMethods', { eventId: EVENT_ID, paymentEngine: engine });
  const list: { paymentTypeId: string; paymentMethod: string; paymentMethodIcon?: string }[] = res && res.status === '1' ? res.paymentMethods : [];
  return list.map(function (m) {
    return { id: String(m.paymentTypeId), name: NAMES[m.paymentMethod] || m.paymentMethod, icon: m.paymentMethodIcon || '', alfredName: m.paymentMethod };
  });
}

// The country's method on Pay.nl, else credit card when the gateway offers it, else the first one.
export function suggestedMethod(methods: { id: string; alfredName: string }[], countryCode: string, engine: string): string {
  const wanted = [engine === 'paynl' ? PAYNL_METHODS[countryCode] : undefined, 'credit card payment'];
  const method = wanted
    .map(function (name) { return methods.filter(function (m) { return m.alfredName === name; })[0]; })
    .filter(Boolean)[0];
  return (method || methods[0] || { id: '' }).id;
}
