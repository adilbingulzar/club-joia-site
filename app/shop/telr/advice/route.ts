// Telr's transaction advice (Telr dashboard: <site>/shop/telr/advice). Only its cart id is used,
// the status is asked from Telr. Anything but 200 makes Telr send it again.
import { advice } from '@/lib/shop/orders';
import { guarded, readBody } from '@/lib/shop/http';

export async function POST(request: Request) {
  return guarded('telr advice', async function () {
    const body = await readBody(request);
    const status = await advice(String(body.tran_cartid || ''));
    return new Response(status === 200 ? 'OK' : 'NOK', { status, headers: { 'Content-Type': 'text/plain' } });
  }, function () {
    return new Response('NOK', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  });
}
