/*
 * The ticket shop over HTTP, with Alfred's ticket API's calls and answers. The site's own pages
 * don't use it: they call lib/shop directly.
 * POST, form fields:
 *   buyTicketsEvents       vendorId                      -> [{ id, eventname, eventCurrency, ... }]
 *   buyTicketsTicketTypes  eventId                       -> [{ id, ticketDescription, ticketPrice, softDelete, ticketVisible }]
 *   buyTicketsSoldOut      ticketId                      -> { left_tickets }
 *   buyTickets             buyer + tickets[i][ticketId|quantity] -> { status: '1', paymentUrl, orderId } or { status: '0', message }
 * Only this site's server calls it, with SHOP_ADMIN_KEY (lib/shop/key.ts): anyone else gets 401,
 * so orders always pass the checkout's checks (age, terms, ...). See lib/shop/orders.ts.
 */
import { buyTickets, events, soldOut, ticketTypes } from '@/lib/shop/orders';
import { guarded, json, notFound, readBody } from '@/lib/shop/http';
import { hasShopKey, shopKey } from '@/lib/shop/key';

const CALLS: Record<string, (body: Record<string, string>) => Promise<unknown>> = {
  buyTicketsEvents: function () { return events(); },
  buyTicketsTicketTypes: function (body) { return ticketTypes(String(body.eventId || '')); },
  buyTicketsSoldOut: function (body) { return soldOut(String(body.ticketId || '')); },
  buyTickets: buyTickets
};

export async function POST(request: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const call = Object.prototype.hasOwnProperty.call(CALLS, name) ? CALLS[name] : null;
  if (!call) return notFound();
  if (!shopKey()) {
    console.error('[shop] SHOP_ADMIN_KEY is not set: the ticket API is closed');
    return json({ status: '0', message: 'Online payment isn’t set up yet. Please contact us to complete your booking.' }, 503);
  }
  if (!hasShopKey(request)) return json({ status: '0', message: 'Not authorised' }, 401);
  return guarded('Api/Eventsnew/' + name, async function () {
    return json(await call(await readBody(request)));
  }, function () {
    return json({ status: '0', message: 'Something went wrong. Please try again in a moment.' }, 502);
  });
}
