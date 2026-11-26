/*
 * After payment (fulfil): the buyer gets the "payment confirmed" email, once per order
 * (shop.orders.fulfilled_at), whichever of the buyer's return and the status sweep comes first.
 *
 * The buyer becomes a member only when staff press "Make member" on the order in the members app
 * (Admin > Sales; app/api/staff make-member, makeMember here): the member with the order's tier and
 * the tickets, in the members app's tables and the way its admin makes them (member.service
 * createMember, membership.service, ticket.service createTicketTx / createCredential), so it shows
 * them as its own: Admin > Members and Tickets, and the member pages with the QR codes. A new
 * account is "pending activation": the members app sends its invitation right after.
 */
import { shopConfig as config } from './config';
import { cuid, db, humanCode, isDuplicate, randomToken, transaction, type Db } from './db';
import { paidEmail } from './email';
import type { OrderItemRow } from './orders';

// actor: the members app user who did it (Make member), null for the shop itself
function audit(c: Db, action: string, entityType: string, entityId: string, after: unknown, actor: string | null = null) {
  return c.query(
    'INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data) VALUES ($1, $6, $2, $3, $4, $5)',
    [cuid(), action, entityType, entityId, JSON.stringify(after), actor]
  );
}

// "CJ300-0007", as the members app numbers members
async function nextMembershipNumber(c: Db): Promise<string> {
  const r = await c.query("SELECT MAX(CAST(SUBSTRING(membership_number, 7) AS UNSIGNED)) AS max FROM members WHERE membership_number REGEXP '^CJ300-[0-9]+$'");
  return 'CJ300-' + String((Number(r.rows[0].max) || 0) + 1).padStart(4, '0');
}

// as the members app prefixes ticket numbers: the event's ticketPrefix, else the start of its slug
function ticketPrefix(event: { slug: string; metadata: { ticketPrefix?: string } | null }): string {
  const meta = event.metadata || {};
  return String(meta.ticketPrefix || event.slug.slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function titleCase(s: string): string {
  return String(s || '').replace(/\b\p{L}/gu, function (ch) { return ch.toUpperCase(); });
}

type Done = { ref: string; email: string; eventName: string; eventStart: string; eventEnd: string; phone: string; items: OrderItemRow[] };

function eventOf(c: Db, eventId: string) {
  return c.query('SELECT id, slug, name, metadata, start_date AS start_day, end_date AS end_day FROM events WHERE id = $1', [eventId])
    .then(function (r) {
      if (!r.rows[0]) throw new Error('event ' + eventId + ' not found');
      return r.rows[0];
    });
}

// the paid order, once: marked done, and what its email says
async function paidTx(c: Db, orderId: number): Promise<Done | null> {
  const o = (await c.query('SELECT * FROM shop.orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
  if (!o || o.fulfilled_at || o.status !== 'paid') return null;
  const event = await eventOf(c, o.event_id);
  await c.query('UPDATE shop.orders SET fulfilled_at = NOW(3), updated_at = NOW(3) WHERE id = $1', [o.id]);
  await audit(c, 'shop.order_paid', 'order', o.ref, { amount: o.amount, currency: o.currency, email: o.buyer && o.buyer.email });
  return {
    ref: o.ref,
    email: (o.buyer && o.buyer.email) || o.email,
    eventName: event.name,
    eventStart: event.start_day,
    eventEnd: event.end_day,
    phone: config.supportPhone(event),
    items: o.items
  };
}

export type Made = { memberId: string; userId: string; membershipNumber: string; newMember: boolean; pendingActivation: boolean; tickets: number; notes: string[] };

// the order's buyer as a member with its tier and tickets (Make member), once per order
async function memberTx(c: Db, ref: string, actor: string | null): Promise<Made | 'not_found' | 'not_paid' | 'done' | 'staff_email'> {
  const o = (await c.query('SELECT * FROM shop.orders WHERE ref = $1 FOR UPDATE', [ref])).rows[0];
  if (!o) return 'not_found';
  if (o.status !== 'paid') return 'not_paid';
  if (o.member_id) return 'done';

  // the audit log's actor must be a members app user; an unknown one is kept as a note instead
  if (actor && !(await c.query('SELECT id FROM users WHERE id = $1', [actor])).rows[0]) actor = null;

  const b = o.buyer;
  const items: OrderItemRow[] = o.items;
  const notes: string[] = [];
  const event = await eventOf(c, o.event_id);

  // the highest tier of the order
  const slugs = Array.from(new Set(items.map(function (i) { return i.tier; })));
  const tiers = (await c.query('SELECT id, slug, sort_order FROM membership_tiers WHERE slug IN ($1) AND active', [slugs])).rows;
  tiers.sort(function (x, y) { return y.sort_order - x.sort_order; });
  const tier = tiers[0];
  if (!tier) throw new Error('no active membership tier of ' + slugs.join(', '));

  // the account: a new member, or the one of this email (the column ignores case)
  let user = (await c.query('SELECT id, email, name, role, status FROM users WHERE email = $1 FOR UPDATE', [b.email])).rows[0];
  if (!user) {
    user = { id: cuid(), email: b.email, name: b.firstName + ' ' + b.lastName, role: 'MEMBER', status: 'PENDING_ACTIVATION' };
    // JSON columns have no default in MySQL: the members app's Prisma defaults
    await c.query(
      "INSERT INTO users (id, email, name, role, status, concierge_categories, updated_at) VALUES ($1, $2, $3, 'MEMBER', 'PENDING_ACTIVATION', '[]', NOW(3))",
      [user.id, user.email, user.name]
    );
  } else if (user.role !== 'MEMBER') {
    // a staff account's email: no member on a staff login (it couldn't sign in to the member pages)
    return 'staff_email';
  }

  let member = (await c.query('SELECT id, membership_number FROM members WHERE user_id = $1 FOR UPDATE', [user.id])).rows[0];
  const hadMember = Boolean(member);
  const membershipStatus = user.status === 'ACTIVE' ? 'ACTIVE' : 'INVITED';
  if (!member) {
    member = { id: cuid(), membership_number: await nextMembershipNumber(c) };
    await c.query(
      `INSERT INTO members (id, user_id, membership_number, first_name, last_name, mobile, country, city,
         preferences, privacy_settings, networking_interests, looking_to_meet, investment_interests, social_links, public_profile_fields, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', '{}', '[]', '[]', '[]', '{}', '[]', NOW(3))`,
      [member.id, user.id, member.membership_number, b.firstName, b.lastName, b.mobile || null, titleCase(b.country) || null, b.city || null]
    );
    await audit(c, 'member.create', 'member', member.id, { email: user.email, membershipNumber: member.membership_number, tier: tier.slug, source: 'shop', order: o.ref }, actor);
  }

  // the membership: new, upgraded to a higher tier, or renewed when it had ended
  const current = (await c.query(
    `SELECT m.id, m.tier_id, m.status, t.sort_order FROM memberships m JOIN membership_tiers t ON t.id = m.tier_id
     WHERE m.member_id = $1 ORDER BY (m.status IN ('ACTIVE', 'INVITED')) DESC, m.issue_date DESC LIMIT 1 FOR UPDATE OF m`,
    [member.id]
  )).rows[0];
  if (!current) {
    const id = cuid();
    await c.query(
      "INSERT INTO memberships (id, member_id, tier_id, membership_number, kind, status, metadata, updated_at) VALUES ($1, $2, $3, $4, 'EVENT', $5, $6, NOW(3))",
      [id, member.id, tier.id, member.membership_number, membershipStatus, JSON.stringify({ source: 'shop', order: o.ref })]
    );
    await audit(c, 'membership.create', 'membership', id, { tier: tier.slug, status: membershipStatus, order: o.ref }, actor);
  } else if (current.status === 'EXPIRED' || current.status === 'CANCELLED') {
    await c.query('UPDATE memberships SET tier_id = $2, status = $3, updated_at = NOW(3) WHERE id = $1', [current.id, tier.id, membershipStatus]);
    await audit(c, 'membership.update', 'membership', current.id, { tier: tier.slug, status: membershipStatus, was: current.status, order: o.ref }, actor);
  } else {
    if (current.sort_order < tier.sort_order) {
      await c.query('UPDATE memberships SET tier_id = $2, updated_at = NOW(3) WHERE id = $1', [current.id, tier.id]);
      await audit(c, 'membership.update', 'membership', current.id, { tier: tier.slug, order: o.ref }, actor);
    }
    if (current.status === 'SUSPENDED') notes.push('membership is suspended');
  }

  // the tickets: each product's ticket types, once for each ticket bought
  const codes = Array.from(new Set(items.flatMap(function (i) { return i.codes; })));
  const types: Record<string, { id: string }> = {};
  (await c.query('SELECT id, code, active FROM ticket_types WHERE event_id = $1 AND code IN ($2)', [event.id, codes])).rows
    .forEach(function (t) { if (t.active) types[t.code] = t; });
  const missing = codes.filter(function (code) { return !types[code]; });
  if (missing.length) notes.push('no active ticket type ' + missing.join(', '));

  const prefix = ticketPrefix(event);
  const numbers: string[] = [];
  for (const item of items) {
    for (let n = 1; n <= item.quantity; n++) {
      for (const code of item.codes) {
        const type = types[code];
        if (!type) continue;
        const id = cuid();
        const number = prefix + '-' + code + '-' + humanCode(6);
        const meta: Record<string, unknown> = { source: 'shop', order: o.ref, product: item.productId };
        if (item.quantity > 1) meta.guest = n;
        await c.query(
          `INSERT INTO tickets (id, event_id, ticket_type_id, member_id, ticket_number, valid_from, valid_until, metadata, updated_at)
           SELECT $1, event_id, id, $2, $3, valid_from, valid_until, $4, NOW(3) FROM ticket_types WHERE id = $5`,
          [id, member.id, number, JSON.stringify(meta), type.id]
        );
        await c.query('INSERT INTO ticket_credentials (id, ticket_id, credential_ref, version) VALUES ($1, $2, $3, 1)', [cuid(), id, randomToken(16)]);
        await audit(c, 'ticket.issue', 'ticket', id, { ticketNumber: number, memberId: member.id, ticketTypeId: type.id, order: o.ref }, actor);
        numbers.push(number);
      }
    }
  }

  await c.query(
    'UPDATE shop.orders SET member_id = $2, tickets = $3, fulfilled_at = COALESCE(fulfilled_at, NOW(3)), updated_at = NOW(3), error = $4 WHERE id = $1',
    [o.id, member.id, JSON.stringify(numbers), notes.length ? notes.join('; ') : null]
  );
  await audit(c, 'shop.order_member', 'order', o.ref, { memberId: member.id, tier: tier.slug, tickets: numbers.length, amount: o.amount, currency: o.currency, notes }, actor);
  if (notes.length) console.error('[shop] order ' + o.ref + ' needs a look: ' + notes.join('; '));

  return {
    memberId: member.id,
    userId: user.id,
    membershipNumber: member.membership_number,
    newMember: !hadMember,
    pendingActivation: user.status === 'PENDING_ACTIVATION',
    tickets: numbers.length,
    notes
  };
}

/**
 * Make member: the paid order's buyer becomes a member (or the member of that email gets the order),
 * with the tier and tickets. actor: the members app user who pressed it. A clash on a unique number
 * (membership or ticket number, staff creating a member at the same moment) is tried again.
 */
export async function makeMember(ref: string, actor: string | null): Promise<Made | 'not_found' | 'not_paid' | 'done' | 'staff_email'> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await transaction(function (c) { return memberTx(c, ref, actor); });
    } catch (e) {
      if (!isDuplicate(e) || attempt === 2) throw e;
    }
  }
}

// The paid order: marked done (once) and the buyer gets the "payment confirmed" email.
export async function fulfil(orderId: number): Promise<Done | null> {
  let done: Done | null;
  try {
    done = await transaction(function (c) { return paidTx(c, orderId); });
  } catch (e) {
    await db.query('UPDATE shop.orders SET error = $2, updated_at = NOW(3) WHERE id = $1', [orderId, String((e as Error).message).slice(0, 500)]).catch(function () {});
    throw e;
  }
  if (done) await paidEmail(done.email, done);
  return done;
}
