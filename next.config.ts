import type { NextConfig } from 'next';

/*
 * Security headers on every response (pages, APIs, files in public/, the pre-registration page).
 *
 * Content-Security-Policy: everything the site loads (scripts, styles, fonts, images) comes from
 * its own domain. Payment needs no exception: the browser only navigates to Telr's page
 * (location.href / a redirect), which CSP doesn't restrict. 'unsafe-inline' for scripts and styles:
 * Next.js puts its page data in inline scripts, and pages are static (a nonce would make every page
 * render per request). Development also needs 'unsafe-eval' (React's error overlay).
 * The ticket files the site passes through from the ticket server (PDFs, QR codes, see rewrites)
 * get no CSP: a PDF viewer must not be held to it.
 */
const dev = process.env.NODE_ENV === 'development';
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export const SECURITY_HEADERS = [
  // HTTPS only, for two years, subdomains included (browsers ignore it on plain http, e.g. localhost)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' }
];

// the ticket server's files (see rewrites): every path except these gets the CSP
const TICKET_FILES = 'booking_events/pdf/|Ajaxdorian/getQrcodeImage/|uploads/qrcodes/|ticketing/download|downloadticketpdf/';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // no "X-Powered-By: Next.js"
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/((?!' + TICKET_FILES + ').*)', headers: [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }] }
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
    const own = [{ source: '/privacy', destination: '/preregister/privacy.html' }];
    // Ticket emails link to this site: their PDF, QR code and images come from the server holding the tickets.
    const server = (process.env.ALFRED_UAE_URL || '').replace(/\/+$/, '');
    if (!server) return own;
    return own.concat(['/booking_events/pdf/:path', '/Ajaxdorian/getQrcodeImage/:path', '/uploads/qrcodes/:path', '/assets/:path*', '/ticketing/download', '/downloadticketpdf/:path'].map(function (source) {
      return { source, destination: server + source };
    }));
  }
};

export default nextConfig;
