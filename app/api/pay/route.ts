/*
 * The card token from Telr's card fields on /pay/<ref> (components/CardPayment.tsx), for the order's
 * IFZA payment: { orderUrl } (the bank's check, shown in a frame), { page } (where to go) or
 * { error, retry }. The card itself never comes here, only Telr's one-time token.
 */
import { NextResponse } from 'next/server';
import { payWithCard } from '@/lib/shop/orders';

const REF = /^[A-Za-z0-9-]{4,64}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(function () { return null; });
  const ref = body && typeof body.ref === 'string' ? body.ref : '';
  const token = body && typeof body.token === 'string' ? body.token.trim() : '';
  if (!REF.test(ref)) return NextResponse.json({ error: 'Order not found.', retry: false }, { status: 404 });
  if (!token || token.length > 4000) return NextResponse.json({ error: 'Please check your card details and try again.', retry: true }, { status: 400 });
  try {
    const r = await payWithCard(ref, token);
    if (!r) return NextResponse.json({ error: 'Order not found.', retry: false }, { status: 404 });
    return NextResponse.json(r, { status: 'error' in r ? 400 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('pay ' + ref + ':', e);
    return NextResponse.json({ error: 'We couldn’t reach the payment service. You have not been charged. Please try again in a moment.', retry: true }, { status: 502 });
  }
}
