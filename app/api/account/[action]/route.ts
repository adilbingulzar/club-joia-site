/*
 * The member's live QR code (member/components/joia/qr-code-display.tsx), from the members app:
 *   POST qr  { ticketNumber }  -> { token, expiresAt, refreshInSeconds }
 * Errors: { error } with the members app's status (401 = signed out).
 */
import { NextResponse } from 'next/server';
import { call } from '@/member/server/api';
import { sameOrigin } from '@/lib/members';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Please use this site.' }, { status: 403, headers: NO_STORE });
  const { action } = await ctx.params;
  if (action !== 'qr') return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
  const body = await request.json().catch(function () { return {}; }) || {};
  const r = await call('qr', { ticketNumber: typeof body.ticketNumber === 'string' ? body.ticketNumber.slice(0, 100) : '' });
  return r.ok ? NextResponse.json(r.data, { headers: NO_STORE }) : NextResponse.json({ error: r.error.message }, { status: r.status, headers: NO_STORE });
}
