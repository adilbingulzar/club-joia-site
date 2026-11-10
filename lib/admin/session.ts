/*
 * The sales dashboard's sign-in (server only): a signed cookie with the staff member the backend
 * accepted (club-joia-300-white, its staff accounts). Signed with a key derived from
 * SHOP_ADMIN_KEY, valid 12 hours like the backend's own staff sessions.
 */
import crypto from 'node:crypto';

export type AdminUser = { id: string; email: string; name: string; role: string };

export const SESSION_COOKIE = 'cj300-admin';
export const SESSION_SECONDS = 12 * 60 * 60;

function key(): Buffer | null {
  const k = process.env.SHOP_ADMIN_KEY || '';
  if (k.length < 16) return null;
  return crypto.createHmac('sha256', k).update('cj300 admin session').digest();
}

function mac(payload: string, k: Buffer): string {
  return crypto.createHmac('sha256', k).update(payload).digest('base64url');
}

export function signSession(user: AdminUser, now = Date.now()): string {
  const k = key();
  if (!k) throw new Error('SHOP_ADMIN_KEY must be set (16+ characters)');
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url');
  return payload + '.' + mac(payload, k);
}

// the staff member of a valid, unexpired cookie, else null
export function readSession(token: string | undefined, now = Date.now()): AdminUser | null {
  const k = key();
  if (!k || !token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload, k));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.exp !== 'number' || data.exp * 1000 <= now || !data.u || typeof data.u.id !== 'string') return null;
    return data.u as AdminUser;
  } catch {
    return null;
  }
}
