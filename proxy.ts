/*
 * Private preview: while PREVIEW_KEY is set, the site only opens for people who
 * visited once with ?preview=<PREVIEW_KEY>. That visit stores a cookie and drops the
 * parameter from the address; everyone else gets a bare 404. Remove PREVIEW_KEY to go public.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PARAM = 'preview';
const COOKIE = 'cj300-preview';

export function proxy(request: NextRequest) {
  const key = process.env.PREVIEW_KEY;
  if (!key) return NextResponse.next();

  const url = request.nextUrl;
  if (url.searchParams.get(PARAM) === key) {
    url.searchParams.delete(PARAM);
    const res = NextResponse.redirect(url);
    // Lax so the cookie still comes along when the payment page sends the buyer back to /thank-you.
    res.cookies.set(COOKIE, key, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  if (request.cookies.get(COOKIE)?.value === key) return NextResponse.next();

  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
  });
}

export const config = {
  // Static build files can't reveal anything on their own; everything else, API included, is gated.
  matcher: ['/((?!_next/static|_next/image).*)']
};
