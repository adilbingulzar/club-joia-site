// The dashboard's orders, filtered as on the page, as a CSV file (up to 10,000 orders).
import { cookies } from 'next/headers';
import { adminGet, SignedOut, type OrderList } from '@/lib/admin/backend';
import { backendQuery, readFilters, today } from '@/lib/admin/filters';
import { ordersCsv } from '@/lib/admin/csv';
import { readSession, SESSION_COOKIE } from '@/lib/admin/session';

export async function GET(request: Request) {
  const user = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return Response.redirect(new URL('/admin/login', request.url), 303);

  const f = readFilters(Object.fromEntries(new URL(request.url).searchParams));
  try {
    const list = await adminGet<OrderList>('orders?' + backendQuery(f, { page: 1, perPage: 10000 }), user);
    return new Response(ordersCsv(list ? list.orders : []), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="club-joia-orders-' + today() + '.csv"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    if (e instanceof SignedOut) return Response.redirect(new URL('/admin/login?expired=1', request.url), 303);
    console.error('admin export:', e);
    return new Response('The orders can’t be exported right now.', { status: 502 });
  }
}
