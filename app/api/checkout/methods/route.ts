/*
 * The payment methods of a gateway for the buyer's country, for the form:
 * GET ?gateway=paynl&country=NL → { methods: [{ id, name, icon }], suggested }.
 */
import { NextResponse } from 'next/server';
import { gateway } from '@/lib/config';
import { country } from '@/lib/countries';
import { ALFRED_URL, EVENT_ID, paymentMethods, suggestedMethod } from '@/lib/alfred';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const g = gateway(params.get('gateway') || '');
  const c = country(params.get('country') || '');
  if (!g || !c) return NextResponse.json({ error: 'Unknown gateway or country.' }, { status: 400 });
  if (!ALFRED_URL || !EVENT_ID) return NextResponse.json({ error: 'Online payment isn’t set up yet.' }, { status: 500 });

  try {
    const methods = await paymentMethods(g.engine);
    return NextResponse.json({
      methods: methods.map(function (m) { return { id: m.id, name: m.name, icon: m.icon }; }),
      suggested: suggestedMethod(methods, c.code, g.engine)
    });
  } catch (e) {
    console.error('checkout methods:', e);
    return NextResponse.json({ error: 'We couldn’t load the payment options.' }, { status: 502 });
  }
}
