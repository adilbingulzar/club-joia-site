/*
 * The shop's admin API (this site's /shop/admin, lib/shop/admin.ts), server side only: at ALFRED_URL,
 * with SHOP_ADMIN_KEY as a bearer token and the signed-in staff member in X-Admin-User.
 */
import type { AdminUser } from './session';
import { shopKeyHeader } from '../shop/key';

export class SignedOut extends Error {}

export type Totals = { revenue: number; orders: number; paid: number; buyers: number; tickets: number; average: number };
export type Stats = {
  currency: string;
  timezone: string;
  totals: Totals;
  byStatus: { status: string; orders: number; amount: number }[];
  byDay: { day: string; revenue: number; paid: number; orders: number }[];
  byProduct: { id: string; name: string; tier: string; price: number; visible: boolean; tickets: number; revenue: number }[];
  byTier: { tier: string; name: string; tickets: number; revenue: number }[];
  byCountry: { country: string; orders: number; revenue: number }[];
  byTicketType: { code: string; name: string; tickets: number }[];
  options: { statuses: string[]; products: { id: string; name: string }[]; tiers: { id: string; name: string }[]; countries: string[] };
};
export type OrderItem = { productId: string; name: string; quantity: number; price: number; tier?: string; codes?: string[] };
export type OrderRow = {
  ref: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  buyer: { name: string; email: string; mobile: string; country: string; address?: string; zipcode?: string; city?: string; gender?: string; birthday?: string };
  items: OrderItem[];
  amount: number;
  currency: string;
  tickets: number;
  error: string | null;
};
export type OrderList = { total: number; page: number; perPage: number; orders: OrderRow[] };
export type OrderDetail = OrderRow & {
  fulfilledAt: string | null;
  updatedAt: string;
  telr: { ref: string | null; status: number | null };
  member: { number: string; email: string; account: string; tier: string | null; membership: string | null } | null;
  ticketList: { number: string; code: string; name: string; status: string }[];
};

function base(): string {
  const url = (process.env.ALFRED_URL || '').replace(/\/+$/, '');
  if (!url || !process.env.SHOP_ADMIN_KEY) throw new Error('ALFRED_URL and SHOP_ADMIN_KEY must be set for the sales dashboard');
  return url;
}

function headers(user?: AdminUser): Record<string, string> {
  const h: Record<string, string> = shopKeyHeader();
  if (user) h['X-Admin-User'] = user.id;
  return h;
}

// GET an admin path; SignedOut when the backend no longer accepts the staff member, null for a 404
export async function adminGet<T>(path: string, user: AdminUser): Promise<T | null> {
  const r = await fetch(base() + '/shop/admin/' + path, { headers: headers(user), cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (r.status === 401) throw new SignedOut();
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Backend shop/admin/' + path.split('?')[0] + ': HTTP ' + r.status);
  return r.json() as Promise<T>;
}

// { user } when the backend accepts the email and password, else { error } for the form
export async function adminLogin(email: string, password: string, ip: string): Promise<{ user?: AdminUser; error?: string }> {
  try {
    const r = await fetch(base() + '/shop/admin/login', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ip }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000)
    });
    const body = await r.json().catch(function () { return {}; });
    if (r.ok && body.user) return { user: body.user };
    if (r.status === 400 || r.status === 401 || r.status === 429) return { error: String(body.error || 'Sign-in failed.') };
    console.error('admin login: backend HTTP ' + r.status);
  } catch (e) {
    console.error('admin login:', e);
  }
  return { error: 'Sign-in isn’t available right now. Please try again in a moment.' };
}

// the pre-registration page's sign-ups (/shop/admin/registrations)
export type Registration = {
  createdAt: string; updatedAt: string; firstName: string; lastName: string; email: string; phone: string;
  country: string; tier: string; source: string; message: string; marketing: boolean;
};
export type Registrations = { total: number; byTier: Record<string, number>; registrations: Registration[] };
