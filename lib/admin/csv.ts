// Orders as CSV for Excel: one row per order, UTF-8 with a BOM so Excel reads the names right.
import type { OrderRow } from './backend';
import { dateTime, itemsText, statusOf } from './format';

// a cell Excel won't run as a formula (a value starting with = + - @ gets a leading ')
function cell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const CSV_COLUMNS = ['Date (Dubai)', 'Order', 'Status', 'Name', 'Email', 'Phone', 'Country', 'Tickets', 'Quantity', 'Amount', 'Currency', 'Paid at (Dubai)', 'Tickets issued', 'Note'];

export function ordersCsv(orders: OrderRow[]): string {
  const rows = [CSV_COLUMNS.map(cell).join(',')];
  orders.forEach(function (o) {
    rows.push([
      dateTime(o.createdAt), o.ref, statusOf(o.status).label, o.buyer.name, o.buyer.email, o.buyer.mobile, o.buyer.country,
      itemsText(o.items), o.items.reduce(function (s, i) { return s + i.quantity; }, 0), o.amount, o.currency,
      dateTime(o.paidAt), o.tickets, o.error
    ].map(cell).join(','));
  });
  return '﻿' + rows.join('\r\n') + '\r\n';
}
