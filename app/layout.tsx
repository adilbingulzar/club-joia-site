import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getCatalog } from '@/lib/catalog';
import { CatalogProvider } from '@/lib/prices';
import Tracking from '@/components/Tracking';

// Prices come from Alfred (lib/catalog), so pages are rendered per request, not at build time.
// The catalogue is handed over unresolved, the page doesn't wait for it.
// Rendering per request is also what puts the request's nonce on Next.js's scripts (lib/csp.ts).
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
  const catalog = getCatalog();
  return (
    // data-scroll-behavior lets Next.js turn off the smooth scrolling from globals.css during page changes.
    <html lang="en" data-scroll-behavior="smooth">
      <body><CatalogProvider catalog={catalog}>{children}</CatalogProvider><Tracking /></body>
    </html>
  );
}
