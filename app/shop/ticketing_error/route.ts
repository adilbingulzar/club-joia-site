// Where the payment link goes when there is no payment page (Telr refused the order, or it was
// declined or cancelled already). The checkout reads it as "no payment page"; a buyer opening it
// lands on the declined page.
import { sitePage } from '@/lib/shop/orders';
import { redirect } from '@/lib/shop/http';

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('orderid') || '';
  return redirect(sitePage('denied', ref));
}
