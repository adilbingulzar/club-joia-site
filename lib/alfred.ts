/*
 * Server side calls to the ticket API (Api/Eventsnew/...), at ALFRED_URL: this site's own
 * (app/Api, lib/shop), which answers the calls Alfred's ticket API did. Each call carries
 * SHOP_ADMIN_KEY, without it the ticket API answers 401.
 */
import { shopKeyHeader } from './shop/key';

export const ALFRED_URL = (process.env.ALFRED_URL || '').replace(/\/+$/, '');
export const EVENT_ID = process.env.ALFRED_EVENT_ID || '';
export const VENDOR_ID = process.env.ALFRED_VENDOR_ID || '';

export async function alfred(path: string, data: Record<string, string>, timeoutMs = 20000) {
  const r = await fetch(ALFRED_URL + '/' + path, {
    method: 'POST',
    headers: shopKeyHeader(),
    body: new URLSearchParams(data),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error('Alfred ' + path + ': HTTP ' + r.status);
  return r.json();
}
