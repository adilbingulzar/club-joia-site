/*
 * Runs for every request (no matcher), files and APIs included.
 *
 * IP allowlist: with IP_ALLOWLIST set, only those addresses get anything, see lib/ip-allowlist.ts.
 *
 * Sales dashboard: /admin and its API (/shop/admin) answer 404 unless SALES_DASHBOARD=on.
 * Closed by default, so a server without the setting never shows it.
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

const PARAM = 'dev';
const COOKIE = 'cj300-dev';

// what visitors see instead of the site: the pre-registration page (public/preregister)
const PAGE = '/preregister/index.html';

// The paths maintenance mode closes, as a whole-path pattern:
// static build files and the site's fonts can't reveal anything on their own;
// the sales dashboard (/admin, with the logo and fonts it shows) has its own sign-in;
// the ticket shop's APIs (Api/Eventsnew, shop/) are called by this site's own server, the bank check's return and the emails;
// the pre-registration page (preregister/), its privacy notice (privacy) and form (api/preregister) are what visitors get;
// everything else, API included, goes to the pre-registration page.
export const MAINTENANCE_PATHS = '/((?!_next/static|_next/image|assets/(?!img/)|assets/img/logo\\.png$|admin(?:/|$)|Api/Eventsnew/|shop/|preregister/|privacy$|api/preregister$).*)';
const closesForMaintenance = new RegExp('^' + MAINTENANCE_PATHS + '$');

// the sales dashboard: its pages, sign-in, exports and server actions (/admin...) and its API (/shop/admin...)
const DASHBOARD = /^\/(admin|shop\/admin)(\/|$)/;

export function proxy(request: NextRequest) {
  if (allowlistVerdict(request.headers) === false) {
    return new NextResponse('Access denied.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (process.env.SALES_DASHBOARD !== 'on' && DASHBOARD.test(request.nextUrl.pathname)) {
    return new NextResponse('Not found.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next();
  if (!closesForMaintenance.test(request.nextUrl.pathname)) return NextResponse.next();

  const key = process.env.MAINTENANCE_KEY;
  const url = request.nextUrl;
  if (key && url.searchParams.get(PARAM) === key) {
    url.searchParams.delete(PARAM);
    const res = NextResponse.redirect(url);
    // Lax so the cookie still comes along when the payment page sends the developer back to /thank-you.
    res.cookies.set(COOKIE, key, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  if (key && request.cookies.get(COOKIE)?.value === key) return NextResponse.next();

  if (url.pathname === '/') return NextResponse.rewrite(new URL(PAGE, request.url));
  if (url.pathname.startsWith('/api/')) {
    return new NextResponse('The site is under maintenance.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' }
    });
  }
  return NextResponse.redirect(new URL('/', request.url));
}

