/*
 * The sales dashboard's filters, from and to the address bar (?range=30d&status=paid ...).
 * Dates are days in the event's time zone, as the backend counts them.
 */
export const TIMEZONE = 'Asia/Dubai';
export const PER_PAGE = 25;

export const RANGES = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom dates' }
] as const;
export type Range = (typeof RANGES)[number]['id'];

export type Filters = {
  range: Range;
  from: string; // YYYY-MM-DD, '' for no limit
  to: string;
  status: string;
  product: string;
  tier: string;
  country: string;
  q: string;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined, max = 100): string {
  return (Array.isArray(v) ? v[0] || '' : v || '').trim().slice(0, max);
}

function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

// today in the event's time zone, YYYY-MM-DD
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
}

const PRESET_DAYS: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

export function readFilters(sp: Params, now = new Date()): Filters {
  let range = one(sp.range) as Range;
  if (!RANGES.some(function (r) { return r.id === range; })) range = 'all';
  // dates filled in without picking "Custom dates"
  if (range === 'all' && (isDate(one(sp.from)) || isDate(one(sp.to)))) range = 'custom';
  let from = '';
  let to = '';
  if (PRESET_DAYS[range]) {
    to = today(now);
    from = addDays(to, 1 - PRESET_DAYS[range]);
  } else if (range === 'custom') {
    from = isDate(one(sp.from)) ? one(sp.from) : '';
    to = isDate(one(sp.to)) ? one(sp.to) : '';
    if (from && to && from > to) { const t = from; from = to; to = t; }
    if (!from && !to) range = 'all';
  }
  const page = parseInt(one(sp.page), 10);
  return {
    range, from, to,
    status: one(sp.status, 20),
    product: one(sp.product, 60),
    tier: one(sp.tier, 40),
    country: one(sp.country, 60),
    q: one(sp.q),
    page: page > 0 ? page : 1
  };
}

// the period just before a dated one, as long as it, for the change figures
export function previousPeriod(f: Filters): { from: string; to: string } | null {
  if (!f.from || !f.to) return null;
  const n = daysBetween(f.from, f.to);
  return { from: addDays(f.from, -n), to: addDays(f.from, -1) };
}

// the backend's query string for these filters
export function backendQuery(f: Filters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  const set = function (k: string, v: string | number) { if (v !== '' && v !== undefined) p.set(k, String(v)); };
  set('from', f.from); set('to', f.to); set('status', f.status); set('product', f.product);
  set('tier', f.tier); set('country', f.country); set('q', f.q);
  Object.keys(extra).forEach(function (k) { set(k, extra[k]); });
  return p.toString();
}

// this page's own query string for these filters (with changes), for links
export function pageQuery(f: Filters, changes: Partial<Filters> = {}): string {
  const g = { ...f, ...changes };
  const p = new URLSearchParams();
  if (g.range !== 'all') p.set('range', g.range);
  if (g.range === 'custom') { if (g.from) p.set('from', g.from); if (g.to) p.set('to', g.to); }
  (['status', 'product', 'tier', 'country', 'q'] as const).forEach(function (k) { if (g[k]) p.set(k, g[k]); });
  if (g.page > 1) p.set('page', String(g.page));
  const s = p.toString();
  return s ? '?' + s : '';
}

export function isFiltered(f: Filters): boolean {
  return f.range !== 'all' || !!(f.status || f.product || f.tier || f.country || f.q);
}
