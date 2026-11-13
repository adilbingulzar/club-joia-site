import type { NextConfig } from 'next';

/*
 * Security headers on every response (pages, APIs, files in public/, the pre-registration page).
 * Content-Security-Policy is set per request (a fresh nonce each time) by proxy.ts, see lib/csp.ts.
 * The bank check's return page (/shop/return/<ref>) comes back inside Telr's frame on /pay/<ref>:
 * only that page may be framed, and only by this site.
 */
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
      // later rules win for the same header
      { source: '/shop/return/:ref', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] }
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
