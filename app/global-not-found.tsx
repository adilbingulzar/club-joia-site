import type { Metadata } from 'next';
import NotFoundPage from '@/components/NotFoundPage';
import './(site)/globals.css';

export const metadata: Metadata = { title: 'Page Not Found | Club JOIA 300', robots: { index: false } };

/*
 * An address no page has (next.config.ts experimental.globalNotFound). It renders apart from every
 * layout, so the site's styles it imports here don't reach the members' pages (app/(member)).
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body><NotFoundPage /></body>
    </html>
  );
}
