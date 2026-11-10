/*
 * Maintenance: while MAINTENANCE_MODE=true the site answers with the page below.
 * Remove it or set it to false and restart the site to open it again.
 * Developers: with MAINTENANCE_KEY set, one visit to ?dev=<MAINTENANCE_KEY> opens the site for
 * that browser. That visit stores a cookie and drops the parameter from the address.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PARAM = 'dev';
const COOKIE = 'cj300-dev';

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Under Maintenance | Club JOIA 300</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050505;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:300;line-height:1.7;text-align:center}
main{padding:24px;max-width:560px}
p{margin:0;font-size:16px;color:#c4c8ce}
h1{margin:12px 0 16px;font-size:clamp(24px,5vw,36px);font-weight:800;line-height:1.25}
</style>
</head>
<body>
<main>
<p>Club JOIA 300</p>
<h1>We’ll be back soon.</h1>
<p>The site is under maintenance. Please check back shortly.</p>
</main>
</body>
</html>
`;

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

  return new NextResponse(PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' }
  });
}

export const config = {
  // Static build files can't reveal anything on their own and ticket emails must keep working (next.config.ts);
  // the sales dashboard (/admin, with the logo it shows) has its own sign-in;
  // everything else, API included, shows the page.
  matcher: ['/((?!_next/static|_next/image|booking_events/pdf/|Ajaxdorian/getQrcodeImage/|uploads/qrcodes/|assets/(?!img/)|assets/img/logo\\.png$|admin(?:/|$)|ticketing/download|downloadticketpdf/).*)']
};
