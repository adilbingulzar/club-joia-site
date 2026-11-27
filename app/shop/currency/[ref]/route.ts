// "Pay in USD | AED" on the payment page (/pay/<ref>): the form posts `to`, the order is made again
// in that currency (lib/shop/orders.ts switchCurrency) and the buyer goes to its payment page.
// Limit: 30 switches per address in an hour; past it the same payment page.
import { payPage, switchCurrency } from '@/lib/shop/orders';
import { guarded, notFound, readBody } from '@/lib/shop/http';
import { hit } from '@/lib/shop/limit';
import { clientIp } from '@/lib/ip-allowlist';

// 303: the browser opens the page with GET after the form's POST
function seeOther(url: string): Response {
  return new Response(null, { status: 303, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Za-z0-9-]{4,64}$/.test(ref)) return notFound('Order not found');
  return guarded('currency ' + ref, async function () {
    if (!(await hit('currency:ip:' + clientIp(request.headers), 30, 60 * 60))) return seeOther(payPage(ref));
    const body = await readBody(request);
    const url = await switchCurrency(ref, String(body.to || '').slice(0, 3));
    return url ? seeOther(url) : notFound('Order not found');
  }, function () {
    return seeOther(payPage(ref));
  });
}
