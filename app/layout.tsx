import type { Metadata, Viewport } from 'next';
// Pages are rendered per request, not at build time: prices are live (lib/catalog), and rendering per
// request is what puts the request's nonce on Next.js's scripts (lib/csp.ts).
// The styles come with each group's layout: the site's (app/(site)/globals.css) and the members' (app/(member)),
// so neither affects the other.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  // the round logo (new file names: /assets is cached for 18 days); /favicon.ico for browsers and search engines that look there
  icons: {
    icon: [
      { url: '/assets/img/icon-v2-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/assets/img/icon-v2-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/assets/img/icon-v2-512.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: { url: '/assets/img/apple-touch-icon-v2.png', sizes: '180x180' }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior lets Next.js turn off the smooth scrolling from the site's globals.css during page changes.
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
