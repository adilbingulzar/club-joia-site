// A payment link from the members app (lib/shop/orders.ts staffLinkUrl): never expires; paid, the
// thank-you page; cancelled by staff, the cancelled page; else the payment page of a payable order.
// Limit: 30 opens per address in an hour; past it the tickets page.
import { staffLinkUrl } from '@/lib/shop/orders';
import { shopConfig } from '@/lib/shop/config';
import { guarded, notFound, redirect } from '@/lib/shop/http';
import { hit } from '@/lib/shop/limit';
import { clientIp } from '@/lib/ip-allowlist';

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Za-z0-9-]{4,64}$/.test(ref)) return notFound('Order not found');
  return guarded('link ' + ref, async function () {
    if (!(await hit('link:ip:' + clientIp(request.headers), 30, 60 * 60))) return redirect(shopConfig.altPaymentUrl);
    const url = await staffLinkUrl(ref);
    return url ? redirect(url) : notFound('Order not found');
  }, function () {
    return new Response('Something went wrong', { status: 500 });
  });
}
