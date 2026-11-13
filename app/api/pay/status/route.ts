/*
 * The payment page asks this when the bank check's return page (in its frame) has told it the buyer
 * is back (IFZA's guide: "let the parent call your server"). Asks IFZA for the order's status
 * (lib/shop/orders.ts settle, 4.3) and answers the site's page to show: { page }.
 * Limits: 20 per order and 60 per address in 15 minutes; past them the pending page, without
 * asking IFZA (the status sweep still settles the order).
 */
import { NextResponse } from 'next/server';
import { settle, sitePage } from '@/lib/shop/orders';
import { hit } from '@/lib/shop/limit';
import { clientIp } from '@/lib/ip-allowlist';

const REF = /^[A-Za-z0-9-]{4,64}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(function () { return null; });
  const ref = body && typeof body.ref === 'string' ? body.ref : '';
  if (!REF.test(ref)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  try {
    if (!(await hit('status:ip:' + clientIp(request.headers), 60, 15 * 60)) || !(await hit('status:ref:' + ref, 20, 15 * 60))) {
      return NextResponse.json({ page: sitePage('pending', ref) }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    }
    const status = await settle(ref);
    if (!status) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ page: sitePage(status, ref) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('pay status ' + ref + ':', e);
    return NextResponse.json({ page: sitePage('pending', ref) }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
