// The payment link of an order (buyTickets' paymentUrl, the emails): the site's payment page (/pay/<ref>).
import { payUrl } from '@/lib/shop/orders';
import { guarded, notFound, redirect } from '@/lib/shop/http';

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  return guarded('pay ' + ref, async function () {
    const url = await payUrl(ref);
    return url ? redirect(url) : notFound('Order not found');
  }, function () {
    return new Response('Something went wrong', { status: 500 });
  });
}
