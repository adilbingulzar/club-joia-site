/*
 * Payment links for the members app (club-joia-300-backend, Admin > Sales > Payment links): staff
 * fill in the checkout's form for a buyer, the order is booked here with who made it, and the
 * buyer pays through /shop/link/<ref> (lib/shop/orders.ts staffLinkUrl).
 * Only the members app's server calls it, with SHOP_ADMIN_KEY (lib/shop/key.ts). JSON in and out:
 *   POST catalog                                   -> { currency, maxPerTicket, tickets: [{ id, name, price, soldOut }], countries: [{ code, name, dial }] }
 *   POST order   { createdBy, buyer, items, linkDays: 1 to 5, sendEmail } -> { ref, url, amount, currency, expiresAt, emailed } or 400 { error }
 *   POST cancel  { ref }                           -> { result: cancelled | paid | busy | not_found }
 *   POST make-member { ref, createdBy }            -> { memberId, userId, membershipNumber, newMember, pendingActivation, tickets, notes }
 *                                                     or 400 { error } (not paid, already a member, a staff email) / 404
 * make-member: Admin > Sales "Make member" (lib/shop/fulfil.ts makeMember), the buyer of a paid order as
 * a member with its tier and tickets; createdBy is the staff user, in the audit log.
 * buyer and items as the site's checkout (lib/checkout.ts). sendEmail: the link goes to the buyer
 * by email too ("Complete your booking", lib/shop/templates.ts paymentLink).
 */
import { CJ_CONFIG as cfg, money } from '@/lib/config';
import { countries } from '@/lib/countries';
import { getCatalog } from '@/lib/catalog';
import { CheckoutError, placeOrder, readBuyer } from '@/lib/checkout';
import { cancelStaffOrder, staffLink } from '@/lib/shop/orders';
import { makeMember } from '@/lib/shop/fulfil';
import { db } from '@/lib/shop/db';
import { shopConfig } from '@/lib/shop/config';
import { paymentLinkEmail } from '@/lib/shop/email';
import { guarded, json, notFound } from '@/lib/shop/http';
import { hasShopKey, shopKey } from '@/lib/shop/key';

async function catalog() {
  const c = await getCatalog();
  return {
    currency: c.currency,
    maxPerTicket: cfg.maxPerTicket,
    tickets: cfg.tickets.map(function (t) {
      const live = c.tickets[t.id];
      return { id: t.id, name: t.name, price: live && live.price != null ? live.price : t.price, soldOut: !c.live || t.soldOut || !live || live.soldOut };
    }),
    countries: countries
  };
}

async function order(body: Record<string, unknown>) {
  const createdBy = typeof body.createdBy === 'string' ? body.createdBy.trim().slice(0, 191) : '';
  if (!createdBy) return json({ error: 'Who made the payment link is missing.' }, 400);
  try {
    if (!body.buyer || typeof body.buyer !== 'object') throw new CheckoutError('Please fill in the buyer’s details.');
    // the form has no repeat field for staff: the email is typed once
    const raw = body.buyer as Record<string, unknown>;
    const buyer = readBuyer({ ...raw, repeatEmail: raw.email });
    const linkDays = [1, 2, 3, 4, 5].indexOf(Number(body.linkDays)) >= 0 ? Number(body.linkDays) : 1;
    const ref = await placeOrder(buyer, body.items, { createdBy, linkDays });
    const o = (await db.query('SELECT amount, currency, items, event_id, link_expires_at FROM shop.orders WHERE ref = $1', [ref])).rows[0];
    const url = staffLink(ref);
    const expiresAt = new Date(o.link_expires_at);
    let emailed = false;
    if (body.sendEmail === true) {
      const event = (await db.query('SELECT name, metadata, start_date AS start_day, end_date AS end_day FROM events WHERE id = $1', [o.event_id])).rows[0] || {};
      emailed = await paymentLinkEmail(buyer.email, {
        firstName: buyer.firstName, payUrl: url, total: money(Number(o.amount), String(o.currency)), expiresAt,
        eventName: event.name || '', eventStart: event.start_day, eventEnd: event.end_day,
        items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items, phone: shopConfig.supportPhone(event)
      });
    }
    return json({ ref, url, amount: Number(o.amount), currency: String(o.currency), expiresAt: expiresAt.toISOString(), emailed });
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.message }, 400);
    throw e;
  }
}

async function makeMemberCall(body: Record<string, unknown>) {
  const createdBy = typeof body.createdBy === 'string' ? body.createdBy.trim().slice(0, 191) : '';
  if (!createdBy) return json({ error: 'Who made the member is missing.' }, 400);
  const r = await makeMember(String(body.ref || '').slice(0, 64), createdBy);
  if (r === 'not_found') return json({ error: 'Order not found.' }, 404);
  if (r === 'not_paid') return json({ error: 'This order isn’t paid, so its buyer can’t be made a member yet.' }, 400);
  if (r === 'done') return json({ error: 'This order’s buyer is already a member.' }, 400);
  if (r === 'staff_email') return json({ error: 'This order’s email belongs to a staff account, so it can’t be a member. Ask the buyer for another email.' }, 400);
  return json(r);
}

const CALLS: Record<string, (body: Record<string, unknown>) => Promise<Response>> = {
  'make-member': makeMemberCall,
  catalog: async function () { return json(await catalog()); },
  order: order,
  cancel: async function (body) { return json({ result: await cancelStaffOrder(String(body.ref || '').slice(0, 64)) }); }
};

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const call = Object.prototype.hasOwnProperty.call(CALLS, action) ? CALLS[action] : null;
  if (!call) return notFound();
  if (!shopKey()) {
    console.error('[shop] SHOP_ADMIN_KEY is not set: payment links are closed');
    return json({ error: 'Payment links aren’t set up on the website (SHOP_ADMIN_KEY).' }, 503);
  }
  if (!hasShopKey(request)) return json({ error: 'Not authorised' }, 401);
  return guarded('api/staff/' + action, async function () {
    const body = await request.json().catch(function () { return {}; });
    return call(body && typeof body === 'object' ? body : {});
  }, function () {
    return json({ error: 'Something went wrong on the website. Please try again in a moment.' }, 502);
  });
}
