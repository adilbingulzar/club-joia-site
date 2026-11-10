/*
 * Maintenance: while MAINTENANCE_MODE=true visitors get the pre-registration page at / (its form:
 * app/api/preregister); every other page sends them there, other APIs answer 503.
 * Remove it or set it to false and restart the site to open it again.
 * Developers: with MAINTENANCE_KEY set, one visit to ?dev=<MAINTENANCE_KEY> opens the site for
 * that browser. That visit stores a cookie and drops the parameter from the address.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PARAM = 'dev';
const COOKIE = 'cj300-dev';

// what visitors see instead of the site: the pre-registration page (public/preregister)
const PAGE = '/preregister/index.html';

export function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next();

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

export const config = {
  // Static build files can't reveal anything on their own and ticket emails must keep working (next.config.ts);
  // the sales dashboard (/admin, with the logo it shows) has its own sign-in;
  // the ticket shop's APIs (Api/Eventsnew, shop/) are called by this site's own server, Telr and the emails;
  // the pre-registration page (preregister/), its privacy notice (privacy) and form (api/preregister) are what visitors get;
  // everything else, API included, goes to the pre-registration page.
  matcher: ['/((?!_next/static|_next/image|booking_events/pdf/|Ajaxdorian/getQrcodeImage/|uploads/qrcodes/|assets/(?!img/)|assets/img/logo\\.png$|admin(?:/|$)|Api/Eventsnew/|shop/|preregister/|privacy$|api/preregister$|ticketing/download|downloadticketpdf/).*)']
};
