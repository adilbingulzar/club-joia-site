// The buyer back from Telr: asks Telr for the order's status, then the site's page
// (/thank-you, /payment/pending, /payment/denied or /payment/cancel).
import { settle, sitePage } from '@/lib/shop/orders';
import { guarded, notFound, redirect } from '@/lib/shop/http';

async function back(ref: string): Promise<Response> {
  return guarded('telr return ' + ref, async function () {
    const status = await settle(ref);
    return status ? redirect(sitePage(status, ref)) : notFound('Order not found');
  }, function () {
    return redirect(sitePage('pending', ref));
  });
}

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  return back((await ctx.params).ref);
}

// Telr may come back with a POST
export async function POST(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  return back((await ctx.params).ref);
}
