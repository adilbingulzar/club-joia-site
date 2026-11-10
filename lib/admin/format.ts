// Numbers, dates and order statuses as the sales dashboard shows them.
import { TIMEZONE } from './filters';

export function money(n: number, currency: string): string {
  return currency + ' ' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function count(n: number): string {
  return n.toLocaleString('en-US');
}

// axis ticks: in full under 10,000, compact from there (10K, 1.5M)
export function compact(n: number): string {
  if (Math.abs(n) < 10000) return n.toLocaleString('en-US');
  if (Math.abs(n) < 1e6) return (n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K';
  return (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
}

export function dateTime(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

// "9 Nov" for a YYYY-MM-DD day
export function dayLabel(day: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(day + 'T00:00:00Z'));
}

export function percent(part: number, whole: number): string {
  if (!whole) return '0%';
  const p = (part / whole) * 100;
  return (p > 0 && p < 1 ? '<1' : Math.round(p)) + '%';
}

// change against the period before: '+12%', null when there's nothing to compare with
export function change(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null;
  const p = Math.round(((now - before) / before) * 100);
  return { text: (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + '%', up: p >= 0 };
}

// order statuses: a label and an icon go with every status color
export const STATUS: Record<string, { label: string; icon: string; tone: string }> = {
  paid: { label: 'Paid', icon: '✓', tone: 'good' },
  pending: { label: 'Pending', icon: '◷', tone: 'warning' },
  cancelled: { label: 'Cancelled', icon: '⊘', tone: 'serious' },
  declined: { label: 'Declined', icon: '✕', tone: 'critical' },
  failed: { label: 'Failed', icon: '!', tone: 'critical' }
};

export function statusOf(s: string) {
  return STATUS[s] || { label: s, icon: '•', tone: 'muted' };
}

// the order's tickets in one line: "2 × Ruby Red, 3 days; 1 × Pearly White, Friday & Saturday"
export function itemsText(items: { name: string; quantity: number }[]): string {
  return items.map(function (i) { return i.quantity + ' × ' + i.name; }).join('; ');
}
