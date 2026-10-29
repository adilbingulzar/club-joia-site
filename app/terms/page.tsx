import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Footer } from '@/components/SiteNav';

export const metadata: Metadata = { title: 'Terms and Conditions | Club JOIA 300' };

// PLACEHOLDER: general ticket terms until the organiser's own text replaces them.
export default function TermsPage() {
  return (
    <>
      <PageHeader cta={{ href: '/tickets', label: 'Get your access' }} />

      <main className="wrap summary legal">
        <div className="page-title">
          <p className="eyebrow">Club JOIA 300</p>
          <h1>Terms and conditions</h1>
          <p>These terms apply to every ticket for Club JOIA 300 at the Abu Dhabi Grand Prix, December 4, 5 &amp; 6. By placing an order you accept them.</p>
        </div>

        <section>
          <h2>1. The organiser</h2>
          <p>Club JOIA 300 is an Elixium Events production (“the organiser”). Tickets are sold on behalf of the organiser through our ticketing platform.</p>
        </section>

        <section>
          <h2>2. Orders</h2>
          <p>Your order is confirmed once the payment has been received. You will then receive your tickets and an order confirmation by email. Please check that your name and email address are correct before you pay.</p>
          <p>Tickets are personal and for the access level and days shown on them. The number of tickets per order and per buyer can be limited.</p>
        </section>

        <section>
          <h2>3. Prices and payment</h2>
          <p>Prices are per guest and shown in the currency of the event. Booking and payment fees, if any, are shown before you pay. Payments are processed by our payment providers (noon, MultiSafepay or Pay.nl); we do not store your card details.</p>
        </section>

        <section>
          <h2>4. Your tickets</h2>
          <ul>
            <li>Every ticket can be used once. Don’t share or publish your ticket or its code.</li>
            <li>Tickets may not be resold or offered for sale without the organiser’s written permission.</li>
            <li>Tickets bought from anyone other than the organiser or its official sales channels can be refused.</li>
          </ul>
        </section>

        <section>
          <h2>5. Entry and conduct</h2>
          <p>Please bring your ticket and a valid ID. The organiser and the venue may refuse entry, or ask a guest to leave, for safety reasons or when house rules or instructions of staff are not followed. Local laws and the rules of the venue and the Grand Prix apply.</p>
        </section>

        <section>
          <h2>6. Changes and cancellation</h2>
          <p>The programme, times and facilities can change. If the event is cancelled by the organiser, you will be informed by email about your options. Except where the law requires otherwise, tickets cannot be exchanged or refunded.</p>
        </section>

        <section>
          <h2>7. Liability</h2>
          <p>Guests attend at their own risk. The organiser is not liable for loss of or damage to personal belongings, or for circumstances outside its control, except where the law does not allow this to be limited.</p>
        </section>

        <section>
          <h2>8. Your data</h2>
          <p>We use the details you give us to process your order, send your tickets and give you access to the event. They are shared only with the parties needed for this, such as the ticketing platform and the payment provider.</p>
        </section>

        <section>
          <h2>9. Questions</h2>
          <p>For questions about your order, reply to your order confirmation email and mention your order number.</p>
        </section>

        <Link className="btn" href="/tickets">Choose your access</Link>
      </main>

      <Footer />
    </>
  );
}
