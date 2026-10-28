import type { Metadata } from 'next';
import { PageHeader, Footer } from '@/components/SiteNav';
import { TierBlocks, OrderBar } from '@/components/Tickets';

export const metadata: Metadata = { title: 'Tickets | Club JOIA 300' };

export default function TicketsPage() {
  return (
    <>
      <PageHeader cta={{ href: '/summary', label: 'Order now', badge: true }} />

      <main>
        <div className="wrap page-title">
          <p className="eyebrow">Step 1 of 3 &nbsp;|&nbsp; Choose tickets</p>
          <h1>Choose your access</h1>
          <p>Pick an access level, the days you want to attend and the number of guests. You can combine different access categories in one order and review the total before paying.</p>
        </div>

        <div className="wrap">
          <TierBlocks />
        </div>
      </main>

      <OrderBar />

      <Footer />
    </>
  );
}
