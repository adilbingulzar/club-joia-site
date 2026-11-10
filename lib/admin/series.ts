// Revenue over time for the dashboard's column chart: every day of the range, weeks past 92 days.
import { addDays, daysBetween, today } from './filters';
import { dayLabel } from './format';

export type DayFigures = { day: string; revenue: number; paid: number; orders: number };
export type Bucket = { key: string; label: string; from: string; to: string; revenue: number; paid: number; orders: number };

const MAX_DAYS = 92;

export function revenueSeries(days: DayFigures[], from: string, to: string, now = new Date()): Bucket[] {
  // the filter's range, else from the first order to today
  const sorted = days.slice().sort(function (a, b) { return a.day < b.day ? -1 : 1; });
  const start = from || (sorted[0] && sorted[0].day) || today(now);
  const end = to || today(now);
  if (start > end) return [];
  const byDay: Record<string, DayFigures> = {};
  sorted.forEach(function (d) { byDay[d.day] = d; });

  const n = daysBetween(start, end);
  const step = n > MAX_DAYS ? 7 : 1;
  const out: Bucket[] = [];
  for (let d = start; d <= end; d = addDays(d, step)) {
    const last = step === 1 ? d : (addDays(d, step - 1) < end ? addDays(d, step - 1) : end);
    const b: Bucket = { key: d, label: dayLabel(d), from: d, to: last, revenue: 0, paid: 0, orders: 0 };
    for (let x = d; x <= last; x = addDays(x, 1)) {
      const f = byDay[x];
      if (f) { b.revenue += f.revenue; b.paid += f.paid; b.orders += f.orders; }
    }
    out.push(b);
  }
  return out;
}
