/*
 * The key between this site's server and its ticket shop APIs (Api/Eventsnew, shop/admin):
 * SHOP_ADMIN_KEY (16+ characters), sent as a bearer token. Browsers and other callers don't have
 * it, so they can't place orders around the checkout's checks or read the dashboard's data.
 */
import crypto from 'node:crypto';

export function shopKey(): string {
  return String(process.env.SHOP_ADMIN_KEY || '').trim();
}

// the header lib/alfred.ts and lib/admin/backend.ts send
export function shopKeyHeader(): Record<string, string> {
  return { Authorization: 'Bearer ' + shopKey() };
}

// true when the request carries the key (compared in constant time)
export function hasShopKey(request: Request): boolean {
  const key = Buffer.from(shopKey());
  const given = Buffer.from(String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  return key.length >= 16 && given.length === key.length && crypto.timingSafeEqual(given, key);
}
