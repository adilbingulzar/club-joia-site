import type { NextConfig } from 'next';

/*
 * Security headers on every response (pages, APIs, files in public/, the pre-registration page).
 *
 * Content-Security-Policy: everything the site loads (scripts, styles, fonts, images) comes from
 * its own domain. The one exception is the payment page (/pay/<ref>): Telr's card fields (IFZA's
 * gateway) must load from secure.telr.com, a script and a frame (IFZA's guide). Buyers always reach
 * that page as a full page load (the checkout, the payment link), so its policy is the one in force
 * there; every other page stays closed to Telr. The bank check returns to /shop/return/<ref> inside
 * that frame: only that page may be framed, and only by this site. 'unsafe-inline' for scripts and styles:
 * Next.js puts its page data in inline scripts, and pages are static (a nonce would make every page
 * render per request). Development also needs 'unsafe-eval' (React's error overlay).
 */
const dev = process.env.NODE_ENV === 'development';
const TELR = 'https://secure.telr.com';
function csp(o: { telr?: boolean; framedBySelf?: boolean } = {}): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : '') + (o.telr ? ' ' + TELR : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    // the card fields and the bank check (Telr), which comes back to this site in the same frame
    ...(o.telr ? ["frame-src 'self' " + TELR] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors " + (o.framedBySelf ? "'self'" : "'none'")
  ].join('; ');
}
export const CONTENT_SECURITY_POLICY = csp();
export const PAYMENT_PAGE_POLICY = csp({ telr: true });
export const PAYMENT_RETURN_POLICY = csp({ framedBySelf: true });

export const SECURITY_HEADERS = [
  // HTTPS only, for two years, subdomains included (browsers ignore it on plain http, e.g. localhost)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' }
];

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // no "X-Powered-By: Next.js"
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }] },
      // later rules win for the same header
      { source: '/pay/:ref', headers: [{ key: 'Content-Security-Policy', value: PAYMENT_PAGE_POLICY }] },
      { source: '/shop/return/:ref', headers: [
        { key: 'Content-Security-Policy', value: PAYMENT_RETURN_POLICY },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
      ] }
    ];
  },
  // the ticket shop's email (pg and @node-rs/argon2 are left out of the bundle by Next itself)
  serverExternalPackages: ['nodemailer', 'mysql2', 'postmark'],
  // Old static-site addresses (shared links, payment success URLs) keep working.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/:page(tickets|summary|thank-you|ruby-red|pearly-white|ultra-black).html', destination: '/:page', permanent: true },
      // the privacy notice is at /privacy
      { source: '/preregister/privacy.html', destination: '/privacy', permanent: true }
    ];
  },
  async rewrites() {
    // the pre-registration page's privacy notice (public/preregister/privacy.html) at /privacy
    return [{ source: '/privacy', destination: '/preregister/privacy.html' }];
  }
};

export default nextConfig;
