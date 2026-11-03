/*
 * Maintenance: while MAINTENANCE_MODE=true the site answers with the page below.
 * Remove it or set it to false and restart the site to open it again.
 */
import { NextResponse } from 'next/server';

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

export function proxy() {
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next();

  return new NextResponse(PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' }
  });
}

export const config = {
  // Static build files can't reveal anything on their own and ticket emails must keep working (next.config.ts);
  // everything else, API included, shows the page.
  matcher: ['/((?!_next/static|_next/image|booking_events/pdf/|Ajaxdorian/getQrcodeImage/|uploads/qrcodes/|assets/(?!img/)|ticketing/download|downloadticketpdf/).*)']
};
