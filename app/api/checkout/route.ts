/*
 * Books the order in the ticket shop (lib/shop), makes its IFZA payment and returns the site's
 * payment page: { url } (/pay/<ref>, the card form). After payment the shop sends the buyer to
 * /thank-you (or /payment/<status>).
 */
import { NextResponse } from 'next/server';
import { CheckoutError, placeOrder, readBuyer } from '@/lib/checkout';
import { country } from '@/lib/countries';
import { shopConfig } from '@/lib/shop/config';
import { preparePayment } from '@/lib/shop/orders';
import { clientIp } from '@/lib/ip-allowlist';
import { attributionFromCookies } from '@/lib/attribution';

export async function POST(request: Request) {
  if (!shopConfig.event || !shopConfig.publicUrl) {
    console.error('checkout: SHOP_EVENT and SHOP_SITE_URL must be set');
    return NextResponse.json({ error: 'Online payment isn’t set up yet. Please contact us to complete your booking.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(function () { return null; });
    if (!body || !Array.isArray(body.items) || !body.items.length || typeof body.buyer !== 'object' || !body.buyer) {
      throw new CheckoutError('Your order is empty.');
    }

    const buyer = readBuyer(body.buyer);
    const buyerCountry = country(buyer.country)!;
    // the ad campaign the buyer came from, if any (proxy.ts keeps it in a cookie)
    const campaign = attributionFromCookies(request.headers.get('cookie'));
    const orderId = await placeOrder(buyer, body.items, {
      // the buyer's address, for the shop's limit on unpaid orders: the one nginx added (the last
      // X-Forwarded-For entry), not one the buyer wrote
      ip: clientIp(request.headers),
      attribution: campaign ? JSON.stringify(campaign) : undefined,
      // USD or AED, as the buyer saw the prices (lib/currency.ts; anything else: the shop's own)
      currency: typeof body.currency === 'string' ? body.currency : undefined
    });
    // the payment now, so a refusal shows on the form
    const pay = await preparePayment(orderId);
    if (pay && pay.state === 'ready') return NextResponse.json({ url: shopConfig.siteUrl + '/pay/' + encodeURIComponent(orderId) });
    console.error('checkout: no payment for', buyerCountry.name, orderId, pay ? pay.state : 'no order');
    throw new CheckoutError(pay && pay.state === 'error' ? pay.message : 'Payment isn’t available for your order right now. You have not been charged. Please try again later.');
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('checkout:', e);
    return NextResponse.json({ error: 'We couldn’t start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
