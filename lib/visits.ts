/*
 * Website visits, counted on this site's own database (shop_visits), for the daily report.
 *
 * Every page a visitor opens is one row: the day (UAE time), an anonymised visitor code, the page and
 * where the visit came from. The pages send it themselves (components/Tracking.tsx, and the
 * pre-registration page's assets/app.js) to /api/visit, so bots that don't run scripts and Next.js's
 * link prefetches are never counted.
 *
 * The visitor code is an HMAC of the day, the connection's address and the browser, with a key from
 * SHOP_ADMIN_KEY: the same person gets one code for the whole day and a new one the next day, and the
 * address is never stored. No cookie is set.
 * Not counted: known bots and page testers (Lighthouse, link previews).
 *
 * The source is worked out on the first page of a visit (its link's utm_source or ad click id, else
 * the site that sent it); pages opened inside the site after that are "internal". A visitor's source
 * for the day is that of their first row of the day (the report queries: docs/visits-report.sql).
 */
import crypto from 'node:crypto';
import { db } from './shop/db';
import { hit } from './shop/limit';

export const UAE_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4, no daylight saving
const PER_HOUR = 600; // page views per connection per hour; more is a script, not a person

/** The UAE date of a moment, as YYYY-MM-DD. */
export function uaeDay(now: Date = new Date()): string {
  return new Date(now.getTime() + UAE_OFFSET_MS).toISOString().slice(0, 10);
}

// the site's pages; anything else (a mistyped address) is "other"
const PAGES: [RegExp, string][] = [
  [/^\/$/, '/'],
  [/^\/(tickets|summary|thank-you|terms|privacy|ruby-red|pearly-white|ultra-black)\/?$/, '/$1'],
  [/^\/payment\/[^/]+\/?$/, '/payment'],
  [/^\/pay\/[^/]+\/?$/, '/pay'],                 // without the order's ref
  [/^\/preregister(\/(index\.html)?)?$/, '/preregister']
];

/** The page as counted: the site's own pages, without query or order refs; else "other". */
export function pageOf(path: unknown): string {
  if (typeof path !== 'string') return 'other';
  const p = path.split(/[?#]/)[0];
  for (const [re, name] of PAGES) if (re.test(p)) return p.replace(re, name);
  return 'other';
}

const BOTS = /bot|crawl|spider|slurp|lighthouse|pagespeed|headless|phantom|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|okhttp|monitor|uptime/i;

/** Known bots, page testers and link previews (by their browser name). */
export function isBot(userAgent: string): boolean {
  return !userAgent || BOTS.test(userAgent);
}

// well-known sites, by the end of their host name
const SITES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)(tiktok\.com)$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(snapchat\.com)$/, 'snapchat']
];

function word(v: string, max = 40): string {
  return v.toLowerCase().replace(/[^a-z0-9._-]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, max);
}

/**
 * Where the first page of a visit came from: its utm_source, an ad click id, else the site that
 * sent it (a known name, or its host), else "direct". `query` is the page's ?query, `referrer`
 * the browser's document.referrer, `host` this site's host.
 */
export function sourceOf(query: string, referrer: string, host: string): string {
  let q: URLSearchParams;
  try { q = new URLSearchParams(query); } catch { q = new URLSearchParams(); }
  const utm = word(q.get('utm_source') || '');
  if (utm) return utm;
  if (q.get('fbclid')) return 'facebook';
  if (q.get('li_fat_id')) return 'linkedin';
  if (q.get('gclid')) return 'google';
  if (q.get('ttclid')) return 'tiktok';
  if (!referrer) return 'direct';
  let from: URL;
  try { from = new URL(referrer); } catch { return 'direct'; }
  const h = from.hostname.toLowerCase().replace(/^www\./, '');
  if (!h || h === host.toLowerCase().replace(/^www\./, '').split(':')[0]) return 'direct';
  for (const [re, name] of SITES) if (re.test(h)) return name;
  return word(h, 60) || 'direct';
}

// the day's anonymised visitor code
export function visitorCode(day: string, ip: string, userAgent: string): string {
  const key = crypto.createHmac('sha256', String(process.env.SHOP_ADMIN_KEY || '')).update('cj300 visits').digest();
  return crypto.createHmac('sha256', key).update(day + '\n' + (ip || 'unknown') + '\n' + userAgent).digest('hex').slice(0, 16);
}

export type Visit = {
  path: unknown;      // location.pathname
  query?: unknown;    // location.search, on the first page of a visit
  referrer?: unknown; // document.referrer, on the first page of a visit
  internal?: unknown; // true for a page opened inside the site
  ip: string;
  userAgent: string;
  host: string;
};

/** Saves one page view; false when it isn't counted (bot, too many). */
export async function recordVisit(v: Visit, now: Date = new Date()): Promise<boolean> {
  if (isBot(v.userAgent)) return false;
  const day = uaeDay(now);
  const visitor = visitorCode(day, v.ip, v.userAgent);
  if (!(await hit('visit:' + visitorCode('', v.ip, ''), PER_HOUR, 60 * 60))) return false;
  const source = v.internal === true ? 'internal'
    : sourceOf(typeof v.query === 'string' ? v.query.slice(0, 2000) : '', typeof v.referrer === 'string' ? v.referrer.slice(0, 2000) : '', v.host);
  await db.query('INSERT INTO shop.visits (day, visitor, path, source) VALUES ($1, $2, $3, $4)', [day, visitor, pageOf(v.path), source]);
  return true;
}
