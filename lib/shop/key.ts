/*
 * The key between this site's server and its ticket shop API (Api/Eventsnew):
 * SHOP_ADMIN_KEY (16+ characters), sent as a bearer token. Browsers and other callers don't have
 * it, so they can't place orders around the checkout's checks.
 */
import crypto from 'node:crypto';

export function shopKey(): string {
  return String(process.env.SHOP_ADMIN_KEY || '').trim();
}

// true when the request carries the key (compared in constant time)
export function hasShopKey(request: Request): boolean {
  const key = Buffer.from(shopKey());
  const given = Buffer.from(String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  return key.length >= 16 && given.length === key.length && crypto.timingSafeEqual(given, key);
}
