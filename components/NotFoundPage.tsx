import Link from 'next/link';
import { PageHeader, Footer } from '@/components/SiteNav';

/* The site's 404 page (app/global-not-found.tsx for unknown addresses, app/(site)/not-found.tsx inside the site's pages). */
export default function NotFoundPage() {
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
