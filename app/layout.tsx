import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getCatalog } from '@/lib/catalog';
import { CatalogProvider } from '@/lib/prices';

// Prices come from Alfred (lib/catalog), so pages are rendered per request, not at build time.
// The catalogue is handed over unresolved, the page doesn't wait for it.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  icons: { icon: { url: '/assets/img/logo.png', type: 'image/png' } }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const catalog = getCatalog();
  return (
    // data-scroll-behavior lets Next.js turn off the smooth scrolling from globals.css during page changes.
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Orbitron:wght@600;800&display=swap" rel="stylesheet" />
      </head>
      <body><CatalogProvider catalog={catalog}>{children}</CatalogProvider></body>
    </html>
  );
}
