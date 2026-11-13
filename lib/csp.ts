/*
 * Content-Security-Policy, set per request by proxy.ts.
 *
 * No inline scripts without this request's nonce: Next.js puts the nonce on its own scripts (it reads
 * it from the request's Content-Security-Policy header, so every page is rendered per request,
 * app/layout.tsx), and the shop's small HTML pages (lib/shop/http.ts) take it from the x-nonce header.
 * Everything else the site loads (scripts, styles, fonts, images) comes from its own domain.
 *
 * The one exception is the payment page (/pay/<ref>): Telr's card fields (IFZA's gateway) load from
 * secure.telr.com, a script and a frame (IFZA's guide). Buyers always reach that page as a full page
 * load (the checkout, the payment link), so its policy is the one in force there; every other page
 * stays closed to Telr. The bank check returns to /shop/return/<ref> inside that frame: only that
 * page may be framed, and only by this site.
 * Inline styles stay allowed (React's style attributes can't carry a nonce). Development also needs
 * 'unsafe-eval' (React's error overlay).
 */
export const TELR = 'https://secure.telr.com';

const PAYMENT_PAGE = /^\/pay\/[^/]+\/?$/;
const PAYMENT_RETURN = /^\/shop\/return\/[^/]+\/?$/;

// a fresh, unguessable value for every request
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function contentSecurityPolicy(nonce: string, path: string, dev = process.env.NODE_ENV === 'development'): string {
  const telr = PAYMENT_PAGE.test(path);
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'" + (dev ? " 'unsafe-eval'" : '') + (telr ? ' ' + TELR : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    // the card fields and the bank check (Telr), which comes back to this site in the same frame
    ...(telr ? ["frame-src 'self' " + TELR] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors " + (PAYMENT_RETURN.test(path) ? "'self'" : "'none'")
  ].join('; ');
}
