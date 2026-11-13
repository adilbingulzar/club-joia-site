// "Complete your payment" in the "One more step to join us" email: a new order for the same
// tickets, then its payment link (lib/shop/orders.ts retryUrl: one open retry at a time, 5 an hour).
// Limit: 20 per address in an hour; past it the tickets page.
import { retryUrl } from '@/lib/shop/orders';
import { shopConfig } from '@/lib/shop/config';
import { guarded, notFound, redirect } from '@/lib/shop/http';
import { hit } from '@/lib/shop/limit';
import { clientIp } from '@/lib/ip-allowlist';

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  return guarded('retry ' + ref, async function () {
    if (!(await hit('retry:ip:' + clientIp(request.headers), 20, 60 * 60))) return redirect(shopConfig.altPaymentUrl);
    const url = await retryUrl(ref);
    return url ? redirect(url) : notFound('Order not found');
  }, function () {
    return new Response('Something went wrong', { status: 500 });
  });
}
