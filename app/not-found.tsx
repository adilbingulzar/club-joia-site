import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Footer } from '@/components/SiteNav';

export const metadata: Metadata = { title: 'Page Not Found | Club JOIA 300', robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <PageHeader />

      <main className="wrap summary">
        <div className="page-title">
          <p className="eyebrow">404</p>
          <h1>This page isn’t on the guest list.</h1>
          <p>The page you’re looking for doesn’t exist or has moved.</p>
        </div>
        <Link className="btn" href="/">Back to Club JOIA 300</Link>
      </main>

      <Footer />
    </>
  );
}
