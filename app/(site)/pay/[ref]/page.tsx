import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader, Footer } from '@/components/SiteNav';
import CardPayment from '@/components/CardPayment';
import { money, ticket } from '@/lib/config';
import { preparePayment } from '@/lib/shop/orders';
import { shopConfig } from '@/lib/shop/config';
import { payCurrencies } from '@/lib/currency';

export const metadata: Metadata = { title: 'Payment | Club JOIA 300', robots: { index: false } };

/*
 * Step 3: the card payment of an order (lib/shop/orders.ts preparePayment). Telr's card fields
 * (IFZA's gateway) load here from secure.telr.com: lib/csp.ts allows that on this page only,
 * which the buyer always reaches as a full page load (the checkout and the payment link).
 */
export default async function PayPage({ params }: { params: Promise<{ ref: string }> }) {
  const ref = (await params).ref;
  if (!/^[A-Za-z0-9-]{4,64}$/.test(ref)) notFound();
  let state: Awaited<ReturnType<typeof preparePayment>>;
  try {
    state = await preparePayment(ref);
  } catch (e) {
    console.error('pay page ' + ref + ':', e);
    state = { state: 'error', message: 'Payment isn’t available right now. You have not been charged. Please try again in a moment.' };
  }
  if (!state) notFound();
  if (state.state === 'done') redirect(state.page);
  // USD | AED: another currency makes the order again in it (app/shop/currency)
  const currencies = payCurrencies(shopConfig.currency);

  return (
    <>
      <PageHeader />

      <main className="wrap summary">
        <div className="page-title">
          <p className="eyebrow">Step 3 of 3 &nbsp;|&nbsp; Payment</p>
          <h1>Secure payment</h1>
          {state.state === 'ready' && <p>Enter your card details. Your bank may ask you to confirm the payment.</p>}
          <p className="order-id">Order number: <strong>{ref}</strong></p>
        </div>

        {state.state === 'expired' && <>
          <p className="alert error" role="alert">This payment has expired and you have not been charged. Please start again: your tickets are checked once more.</p>
          <div className="actions"><Link className="btn" href={'/shop/retry/' + encodeURIComponent(ref)} prefetch={false}>Start again</Link></div>
        </>}

        {state.state === 'error' && <>
          <p className="alert error" role="alert">{state.message}</p>
          <div className="actions"><Link className="btn" href="/summary">Back to your order</Link></div>
        </>}

        {state.state === 'ready' && <>
          {currencies.length > 1 && <form className="currency-switch" method="post" action={'/shop/currency/' + encodeURIComponent(ref)} aria-label="Currency">
            <span>Pay in</span>
            {currencies.map(function (cur) {
              return <button type="submit" name="to" value={cur} key={cur} aria-pressed={cur === state.currency.toUpperCase()}>{cur}</button>;
            })}
          </form>}
          <table className="lines">
            <thead><tr><th scope="col">Ticket</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Subtotal</th></tr></thead>
            <tbody>
              {state.items.map(function (i) {
                const t = ticket(i.productId);
                return <tr key={i.productId}><td className="item"><i className={'sw ' + (t ? t.swatch : '')}></i><span>{i.name}{t && <small>{t.pkg.dates}</small>}</span></td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{money(i.price * i.quantity, state.currency)}</td></tr>;
              })}
            </tbody>
          </table>
          <dl className="totals">
            {state.discount > 0 && <>
              <div><dt>Tickets</dt><dd>{money(state.amount + state.discount, state.currency)}</dd></div>
              <div><dt>Discount</dt><dd>&minus;{money(state.discount, state.currency)}</dd></div>
            </>}
            <div className="grand"><dt>Total <small className="vat">incl. VAT</small></dt><dd>{money(state.amount, state.currency)}</dd></div>
          </dl>
          <CardPayment orderRef={ref} init={state.init} total={money(state.amount, state.currency)} />
        </>}
      </main>

      <Footer />
    </>
  );
}
