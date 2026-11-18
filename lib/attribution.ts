/*
 * Where a buyer came from (ad campaigns): the utm_* tags and ad click ids of the link they arrived
 * with, kept in a first-party cookie for 30 days (proxy.ts) and saved with their order
 * (app/api/checkout, lib/shop/orders.ts: shop_orders.attribution). The latest tagged visit wins.
 * Pre-registrations and plain visits store nothing.
 */

export const ATTRIBUTION_COOKIE = 'cj300-src';
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30;

// utm_* tags, then the click ids of Meta, Google, TikTok and LinkedIn ads
export const TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ttclid', 'li_fat_id'] as const;
type Tag = typeof TAGS[number];

export type Attribution = Partial<Record<Tag, string>> & {
  landing?: string;  // the page of the tagged visit (path only)
  referrer?: string; // the site that sent it (another site's address, without its query)
  at?: string;       // when (ISO 8601)
};

const MAX = 200;

// printable text only, trimmed and cut; '' when nothing is left
function clean(v: unknown, max = MAX): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** The tags of a visit's address, or null when it has none. */
export function fromVisit(url: URL, referer: string | null, now = new Date()): Attribution | null {
  const a: Attribution = {};
  for (const t of TAGS) {
    const v = clean(url.searchParams.get(t));
    if (v) a[t] = v;
  }
  if (!Object.keys(a).length) return null;
  a.landing = clean(url.pathname);
  const from = otherSite(referer, url.host);
  if (from) a.referrer = from;
  a.at = now.toISOString();
  return a;
}

// another site's address without query or fragment; null for this site or a bad value
function otherSite(referer: string | null, host: string): string | null {
  if (!referer) return null;
  try {
    const r = new URL(referer);
    if (r.host === host || (r.protocol !== 'https:' && r.protocol !== 'http:')) return null;
    return clean(r.origin + r.pathname);
  } catch {
    return null;
  }
}

/** The cookie's value: base64url JSON. */
export function encodeAttribution(a: Attribution): string {
  return Buffer.from(JSON.stringify(a)).toString('base64url');
}

/** Read back and checked field by field; null when missing, broken or empty. */
export function decodeAttribution(value: string | null | undefined): Attribution | null {
  if (!value || value.length > 4000) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  return checked(raw);
}

/** Only the known fields, as clean text. */
export function checked(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const a: Attribution = {};
  for (const t of TAGS) {
    const v = clean(r[t]);
    if (v) a[t] = v;
  }
  if (!Object.keys(a).length) return null;
  const landing = clean(r.landing);
  if (landing.startsWith('/')) a.landing = landing;
  const referrer = clean(r.referrer);
  if (/^https?:\/\//.test(referrer)) a.referrer = referrer;
  const at = clean(r.at, 40);
  if (at && !isNaN(Date.parse(at))) a.at = new Date(at).toISOString();
  return a;
}

/** The cookie from a request's Cookie header. */
export function attributionFromCookies(cookieHeader: string | null): Attribution | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === ATTRIBUTION_COOKIE) return decodeAttribution(part.slice(i + 1).trim());
  }
  return null;
}
