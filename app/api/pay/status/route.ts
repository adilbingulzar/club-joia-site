/*
 * The payment page asks this when the bank check's return page (in its frame) has told it the buyer
 * is back (IFZA's guide: "let the parent call your server"). Asks IFZA for the order's status
 * (lib/shop/orders.ts settle, 4.3) and answers the site's page to show: { page }.
 */
import { NextResponse } from 'next/server';
import { settle, sitePage } from '@/lib/shop/orders';

const REF = /^[A-Za-z0-9-]{4,64}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(function () { return null; });
  const ref = body && typeof body.ref === 'string' ? body.ref : '';
  if (!REF.test(ref)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  try {
    const status = await settle(ref);
    if (!status) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ page: sitePage(status, ref) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('pay status ' + ref + ':', e);
    return NextResponse.json({ page: sitePage('pending', ref) }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
