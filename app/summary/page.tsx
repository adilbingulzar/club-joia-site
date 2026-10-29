import type { Metadata } from 'next';
import { PageHeader, Footer } from '@/components/SiteNav';
import Summary from '@/components/Summary';

export const metadata: Metadata = { title: 'Order Summary | Club JOIA 300', robots: { index: false } };

// Alfred sends the buyer back here as /summary?orderid=<transaction id> when the payment is denied or cancelled.
export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ orderid?: string | string[] }> }) {
  const failed = !!(await searchParams).orderid;

  return (
    <>
      <PageHeader cta={{ href: '/tickets', label: 'Get your access' }} />
      <Summary termsUrl="/terms" paymentFailed={failed} />
      <Footer />
    </>
  );
}
