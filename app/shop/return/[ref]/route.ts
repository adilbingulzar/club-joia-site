/*
 * The buyer back from the bank's check (IFZA's return_url, ?payment_id=...&outcome=...).
 * IFZA's guide, "Your return page": it may open inside the frame or as the whole page, because some
 * banks break out of the frame. Handle both:
 *
 * - Inside the frame (Sec-Fetch-Dest: iframe): send payment_id to the parent page with postMessage,
 *   and let the parent call our server (/pay/<ref> → app/api/pay/status).
 * - As the whole page: our server asks IFZA for the order's status (settle; outcome is only for
 *   display, anyone can type it), then the site's page (/thank-you, /payment/pending,
 *   /payment/denied or /payment/cancel). Also when a browser doesn't say it's in a frame: the page
 *   then takes the whole window there.
 *
 * next.config.ts lets this site, and only this site, frame this page.
 */
import { settle, sitePage } from '@/lib/shop/orders';
import { breakOut, guarded, notFound, tellParent } from '@/lib/shop/http';

async function back(ref: string): Promise<Response> {
  return guarded('return ' + ref, async function () {
    const status = await settle(ref);
    return status ? breakOut(sitePage(status, ref)) : notFound('Order not found');
  }, function () {
    return breakOut(sitePage('pending', ref));
  });
}

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const ref = (await ctx.params).ref;
  const url = new URL(request.url);
  if (request.headers.get('sec-fetch-dest') === 'iframe' && !url.searchParams.has('whole')) {
    url.searchParams.set('whole', '1');
    return tellParent(ref, String(url.searchParams.get('payment_id') || '').slice(0, 100), url.pathname + url.search);
  }
  return back(ref);
}

// in case the gateway comes back with a POST
export async function POST(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  return back((await ctx.params).ref);
}
