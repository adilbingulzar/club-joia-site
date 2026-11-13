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
 * next.config.ts and lib/csp.ts let this site, and only this site, frame this page. The page's
 * script carries the request's nonce (proxy.ts).
 * Limits: 20 per order and 60 per address in 15 minutes; past them the pending page, without asking
 * IFZA (the status sweep still settles the order).
 */
import { settle, sitePage } from '@/lib/shop/orders';
import { breakOut, guarded, notFound, tellParent } from '@/lib/shop/http';
import { hit } from '@/lib/shop/limit';
import { clientIp } from '@/lib/ip-allowlist';

async function back(ref: string, request: Request): Promise<Response> {
  const nonce = request.headers.get('x-nonce');
  return guarded('return ' + ref, async function () {
    if (!(await hit('return:ip:' + clientIp(request.headers), 60, 15 * 60)) || !(await hit('return:ref:' + ref, 20, 15 * 60))) {
      return breakOut(sitePage('pending', ref), nonce);
    }
    const status = await settle(ref);
    return status ? breakOut(sitePage(status, ref), nonce) : notFound('Order not found');
  }, function () {
    return breakOut(sitePage('pending', ref), nonce);
  });
}

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const ref = (await ctx.params).ref;
  const url = new URL(request.url);
  if (request.headers.get('sec-fetch-dest') === 'iframe' && !url.searchParams.has('whole')) {
    url.searchParams.set('whole', '1');
    return tellParent(ref, String(url.searchParams.get('payment_id') || '').slice(0, 100), url.pathname + url.search, request.headers.get('x-nonce'));
  }
  return back(ref, request);
}

// in case the gateway comes back with a POST
export async function POST(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  return back((await ctx.params).ref, request);
}
