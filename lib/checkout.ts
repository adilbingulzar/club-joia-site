/*
 * The checkout's buyer and tickets, checked, and booked in the ticket shop (lib/shop/orders
 * buyTickets). Used by the site's checkout (app/api/checkout) and by the members app's payment
 * links (app/api/staff), so both take the same details and the same prices.
 */
import { CJ_CONFIG as cfg, ticket } from '@/lib/config';
import { country } from '@/lib/countries';
import { getCatalog } from '@/lib/catalog';
import { shopConfig } from '@/lib/shop/config';
import { buyTickets, ticketTypes } from '@/lib/shop/orders';
import { isOver21, UNDER_21 } from '@/lib/age';

export type Buyer = {
  firstName: string; lastName: string; email: string; repeatEmail: string;
  address: string; zipcode: string; city: string; country: string; gender: string;
  birthday: string; phoneCode: string; phone: string; over21: boolean; terms: boolean; agencyCode: string;
};

/** A message for the person filling in the form. */
export class CheckoutError extends Error {}

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// the optional agency (seller) code: letters, digits, space, - _ . only, upper case, up to 50
function agencyCode(v: unknown): string {
  return text(v, 50).replace(/[^A-Za-z0-9 _.\-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function validBirthday(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getTime() < Date.now() && d.getUTCFullYear() >= 1900;
}

/** The buyer as the checkout form sends it, checked; throws a CheckoutError. */
export function readBuyer(raw: Record<string, unknown>): Buyer {
  const b: Buyer = {
    firstName: text(raw.firstName), lastName: text(raw.lastName),
    email: text(raw.email, 150).toLowerCase(), repeatEmail: text(raw.repeatEmail, 150).toLowerCase(),
    address: text(raw.address, 200), zipcode: text(raw.zipcode, 20), city: text(raw.city),
    country: text(raw.country, 2), gender: text(raw.gender, 10), birthday: text(raw.birthday, 10),
    phoneCode: text(raw.phoneCode, 2), phone: text(raw.phone, 20).replace(/[\s\-()]/g, ''),
    over21: raw.over21 === true, terms: raw.terms === true,
    agencyCode: agencyCode(raw.agencyCode)
  };

  if (!b.firstName || !b.lastName || !b.address || !b.zipcode || !b.city) throw new CheckoutError('Please fill in all fields.');
  if (!/^[\p{L}\p{M}' .\-]+$/u.test(b.firstName + b.lastName)) throw new CheckoutError('Please use letters only in your name.');
  if (!/^[A-Za-z0-9 \-]{2,20}$/.test(b.zipcode)) throw new CheckoutError('Please enter a valid zip code.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) throw new CheckoutError('Please enter a valid email address.');
  if (b.email !== b.repeatEmail) throw new CheckoutError('The email addresses don’t match.');
  if (!country(b.country)) throw new CheckoutError('Please select your country.');
  if (b.gender && ['male', 'female', 'nogender'].indexOf(b.gender) < 0) throw new CheckoutError('Please select your gender.');
  if (b.birthday && !validBirthday(b.birthday)) throw new CheckoutError('Please enter a valid birthday.');
  if (b.birthday && !isOver21(b.birthday)) throw new CheckoutError(UNDER_21);
  if (!country(b.phoneCode) || !/^\d{6,15}$/.test(b.phone)) throw new CheckoutError('Please enter a valid phone number.');
  if (!b.over21) throw new CheckoutError('Please confirm that you are older than 21.');
  if (!b.terms) throw new CheckoutError('Please agree to the terms and conditions.');
  return b;
}

// the shop's ticket ids of the event by name ("Ruby Red, 3 days"), the ones on sale
async function ticketIds(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  (await ticketTypes(shopConfig.event)).forEach(function (t) {
    if (t.softDelete === '0' && t.ticketVisible === '1') ids[String(t.ticketDescription).trim()] = String(t.id);
  });
  return ids;
}

/**
 * Books the order (unpaid) and gives its reference; throws a CheckoutError with a message for the
 * buyer. `items` as the site's cart: [{ id: "<tier>/<package>", quantity }].
 * ip: the buyer's address (the shop's limit on unpaid orders); attribution: the ad campaign (JSON);
 * createdBy: the members app staff account that made it (a payment link), which has no such limit,
 * payable for linkDays days.
 */
export async function placeOrder(buyer: Buyer, items: unknown, extra: { ip?: string; attribution?: string; createdBy?: string; linkDays?: number } = {}): Promise<string> {
  if (!Array.isArray(items) || !items.length) throw new CheckoutError('Your order is empty.');
  const buyerCountry = country(buyer.country)!;
  const catalog = await getCatalog();
  if (!catalog.live) throw new CheckoutError('Ticket prices can’t be loaded right now. You have not been charged. Please try again in a moment.');
  const ids = await ticketIds();

  const form: Record<string, string> = {
    name: buyer.firstName,
    surname: buyer.lastName,
    email: buyer.email,
    address: buyer.address,
    zipcode: buyer.zipcode,
    city: buyer.city,
    country: buyerCountry.name.toLowerCase(),
    countryCode: buyerCountry.code,
    countryPhoneCode: country(buyer.phoneCode)!.dial,
    phoneNumber: buyer.phone,
    ip: extra.ip || ''
  };
  // left out when empty
  if (buyer.gender) form.gender = buyer.gender;
  if (buyer.birthday) form.age = buyer.birthday;
  if (buyer.agencyCode) form.agencyCode = buyer.agencyCode;
  if (extra.attribution) form.attribution = extra.attribution;

  items.slice(0, cfg.tickets.length).forEach(function (item: { id?: unknown; quantity?: unknown }, i: number) {
    const t = ticket(String(item && item.id));
    const quantity = Number(item && item.quantity);
    if (!t || t.soldOut || !catalog.tickets[t.id] || catalog.tickets[t.id].soldOut || !Number.isInteger(quantity) || quantity < 1 || quantity > cfg.maxPerTicket) {
      throw new CheckoutError('Your order has a ticket that isn’t available. Please review your tickets.');
    }
    if (!ids[t.name]) throw new CheckoutError(t.name + ' isn’t on sale at the moment. Please choose another ticket.');
    form['tickets[' + i + '][ticketId]'] = ids[t.name];
    form['tickets[' + i + '][quantity]'] = String(quantity);
  });

  const res = await buyTickets(form, extra.createdBy ? { createdBy: extra.createdBy, linkDays: extra.linkDays } : {});
  if (res.status === '1' && res.orderId) return res.orderId;
  // the shop's messages are written for buyers (sold out, unfinished orders, ...)
  throw new CheckoutError(res && res.message ? String(res.message) : 'We couldn’t start the payment. Please try again in a moment.');
}
