import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, Footer } from '@/components/SiteNav';
import ClearCart from '@/components/ClearCart';

/*
 * The pages Alfred sends the buyer to when a payment hasn't simply succeeded, as
 * /payment/<status>?orderid=<transaction id>. In Alfred each is a vendor landing page
 * (E-Ticketing, url type) of the same name: pending, authorised, verify, cancel, denied, pinCanceled.
 * Success goes to /thank-you.
 */
type Page = { title: string; eyebrow: string; heading: string; text: string; inProgress: boolean };

const PAGES: Record<string, Page> = {
  pending: {
    title: 'Payment Pending', eyebrow: 'Payment in progress', heading: 'Your payment is being processed.',
    text: 'This can take a few minutes. As soon as your payment is confirmed, your tickets are sent to your email. Please don’t pay again.',
    inProgress: true
  },
  authorised: {
    title: 'Payment Authorised', eyebrow: 'Payment authorised', heading: 'Your payment is authorised.',
    text: 'We are completing your payment. As soon as it is confirmed, your tickets are sent to your email. Please don’t pay again.',
    inProgress: true
  },
  verify: {
    title: 'Payment Verification', eyebrow: 'Payment being checked', heading: 'Your payment is being verified.',
    text: 'Your bank or our payment provider is checking this payment. Once it is approved, your tickets are sent to your email. Please don’t pay again.',
    inProgress: true
  },
  cancel: {
    title: 'Payment Cancelled', eyebrow: 'Payment cancelled', heading: 'Your payment was cancelled.',
    text: 'You have not been charged. Your tickets are still in your order, so you can try again or choose another payment method.',
    inProgress: false
  },
  denied: {
    title: 'Payment Declined', eyebrow: 'Payment declined', heading: 'Your payment didn’t go through.',
    text: 'You have not been charged. Please try again, use another card or choose another payment method.',
    inProgress: false
  }
};
// the pin terminal's cancel, as Alfred names it
PAGES.pinCanceled = PAGES.cancel;

type Props = { params: Promise<{ status: string }>; searchParams: Promise<{ orderid?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = PAGES[(await params).status];
  return { title: (page ? page.title : 'Payment') + ' | Club JOIA 300', robots: { index: false } };
}

export default async function PaymentStatusPage({ params, searchParams }: Props) {
  const page = PAGES[(await params).status];
  if (!page) notFound();
  const orderId = String((await searchParams).orderid || '').replace(/[^\w-]/g, '').slice(0, 64);

  return (
    <>
      <PageHeader />

      <main className="wrap summary">
        <div className="page-title">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.heading}</h1>
          <p>{page.text}</p>
          {orderId && <p className="order-id">Order number: <strong>{orderId}</strong></p>}
        </div>
        {page.inProgress
          ? <Link className="btn" href="/">Back to Club JOIA 300</Link>
          : <div className="actions">
              <Link className="btn-ghost" href="/tickets">Edit tickets</Link>
              <Link className="btn" href="/summary">Try again</Link>
            </div>}
      </main>

      <Footer />
      {/* the order is placed: a new one would book the tickets twice */}
      {page.inProgress && <ClearCart />}
    </>
  );
}
