import type { Metadata } from 'next';
import NotFoundPage from '@/components/NotFoundPage';

export const metadata: Metadata = { title: 'Page Not Found | Club JOIA 300', robots: { index: false } };

// a site page that calls notFound() (the site's layout brings its styles)
export default function NotFound() {
  return <NotFoundPage />;
}
