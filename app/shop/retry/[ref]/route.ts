// "Complete your payment" in the "One more step to join us" email: a new order for the same
// tickets, then its payment link (lib/shop/orders.ts retryUrl).
import { retryUrl } from '@/lib/shop/orders';
import { guarded, notFound, redirect } from '@/lib/shop/http';

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  return guarded('retry ' + ref, async function () {
    const url = await retryUrl(ref);
    return url ? redirect(url) : notFound('Order not found');
  }, function () {
    return new Response('Something went wrong', { status: 500 });
  });
}
