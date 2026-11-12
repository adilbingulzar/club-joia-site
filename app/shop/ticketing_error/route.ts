// Where the payment link goes when an order can't be paid (IFZA refused it, or it was
// declined or cancelled already). A buyer opening it lands on the declined page.
import { sitePage } from '@/lib/shop/orders';
import { redirect } from '@/lib/shop/http';

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('orderid') || '';
  return redirect(sitePage('denied', ref));
}
