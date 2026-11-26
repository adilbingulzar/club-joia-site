import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Footer } from '@/components/SiteNav';
import ClearCart from '@/components/ClearCart';
import TrackPurchase from '@/components/TrackPurchase';
import { paidOrder } from '@/lib/shop/orders';

export const metadata: Metadata = { title: 'Thank You | Club JOIA 300', robots: { index: false } };

// Alfred sends the buyer here after payment as /thank-you?orderid=<transaction id>.
export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ orderid?: string | string[] }> }) {
  const orderId = String((await searchParams).orderid || '').replace(/[^\w-]/g, '').slice(0, 64);
  // the ad platforms count a purchase only for an order that is really paid
  const paid = orderId ? await paidOrder(orderId).catch(function () { return null; }) : null;

  return (
    <>
      <PageHeader />

      <main className="wrap summary">
        <div className="page-title">
          <p className="eyebrow">Booking received</p>
          <h1>Thank you. See you on deck.</h1>
          <p>Your payment is complete. A confirmation with your ticket details is on its way to your email.</p>
          {orderId && <p className="order-id">Order number: <strong>{orderId}</strong></p>}
        </div>
        <Link className="btn" href="/">Back to Club JOIA 300</Link>
      </main>

      <Footer />
      <ClearCart />
      {paid && <TrackPurchase purchase={paid} />}
    </>
  );
}
