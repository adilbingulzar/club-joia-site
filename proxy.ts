/*
 * Runs for every request (no matcher), files and APIs included.
 *
 * Content-Security-Policy (lib/csp.ts): a fresh nonce for every request, in the policy sent back and
 * in the request headers, where Next.js (its own scripts) and the shop's pages (x-nonce) find it.
 *
 * IP allowlist: with IP_ALLOWLIST set, only those addresses get anything, see lib/ip-allowlist.ts.
 *
 * Maintenance: while MAINTENANCE_MODE=true visitors get the pre-registration page at / (its form:
 * app/api/preregister); every other page sends them there, other APIs answer 503.
 * Remove it or set it to false and restart the site to open it again.
 * Developers: with MAINTENANCE_KEY set, one visit to ?dev=<MAINTENANCE_KEY> opens the site for
 * that browser. That visit stores a cookie and drops the parameter from the address.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { allowlistVerdict } from '@/lib/ip-allowlist';
import { contentSecurityPolicy, newNonce } from '@/lib/csp';

const PARAM = 'dev';
const COOKIE = 'cj300-dev';

// what visitors see instead of the site: the pre-registration page (public/preregister)
const PAGE = '/preregister/index.html';

// The paths maintenance mode closes, as a whole-path pattern:
// static build files and the logo (the browser tab's icon) can't reveal anything on their own;
// the ticket shop's APIs (Api/Eventsnew, shop/) are called by this site's own server, the bank check's return and the emails;
// the pre-registration page (preregister/), its privacy notice (privacy) and form (api/preregister) are what visitors get;
// everything else, API included, goes to the pre-registration page.
export const MAINTENANCE_PATHS = '/((?!_next/static|_next/image|assets/img/logo\\.png$|Api/Eventsnew/|shop/|preregister/|privacy$|api/preregister$).*)';
const closesForMaintenance = new RegExp('^' + MAINTENANCE_PATHS + '$');

export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce, request.nextUrl.pathname);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const res = answer(request, { request: { headers } });
  res.headers.set('Content-Security-Policy', policy);
  return res;
}

// what the request gets; pass = the request headers with the nonce, for the page that renders
function answer(request: NextRequest, pass: { request: { headers: Headers } }): NextResponse {
  if (allowlistVerdict(request.headers) === false) {
    return new NextResponse('Access denied.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next(pass);
  if (!closesForMaintenance.test(request.nextUrl.pathname)) return NextResponse.next(pass);

  const key = process.env.MAINTENANCE_KEY;
  const url = request.nextUrl;
  if (key && url.searchParams.get(PARAM) === key) {
    url.searchParams.delete(PARAM);
    const res = NextResponse.redirect(url);
    // Lax so the cookie still comes along when the payment page sends the developer back to /thank-you.
    res.cookies.set(COOKIE, key, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  if (key && request.cookies.get(COOKIE)?.value === key) return NextResponse.next(pass);

  if (url.pathname === '/') return NextResponse.rewrite(new URL(PAGE, request.url), pass);
  if (url.pathname.startsWith('/api/')) {
    return new NextResponse('The site is under maintenance.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' }
    });
  }
  return NextResponse.redirect(new URL('/', request.url));
}

