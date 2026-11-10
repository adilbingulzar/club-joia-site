/*
 * Books the order in the ticket shop (lib/shop) and returns Telr's payment page: { url }.
 * After payment the shop sends the buyer to /thank-you (or /payment/<status>).
 */
import { NextResponse } from 'next/server';
import { CJ_CONFIG as cfg, ticket } from '@/lib/config';
import { country } from '@/lib/countries';
import { getCatalog } from '@/lib/catalog';
import { shopConfig } from '@/lib/shop/config';
import { buyTickets, payUrl, ticketTypes } from '@/lib/shop/orders';
import { isOver21, UNDER_21 } from '@/lib/age';

type Buyer = {
  firstName: string; lastName: string; email: string; repeatEmail: string;
  address: string; zipcode: string; city: string; country: string; gender: string;
  birthday: string; phoneCode: string; phone: string; over21: boolean; terms: boolean;
};

class CheckoutError extends Error {}

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function validBirthday(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getTime() < Date.now() && d.getUTCFullYear() >= 1900;
}

function readBuyer(raw: Record<string, unknown>): Buyer {
  const b: Buyer = {
    firstName: text(raw.firstName), lastName: text(raw.lastName),
    email: text(raw.email, 150).toLowerCase(), repeatEmail: text(raw.repeatEmail, 150).toLowerCase(),
    address: text(raw.address, 200), zipcode: text(raw.zipcode, 20), city: text(raw.city),
    country: text(raw.country, 2), gender: text(raw.gender, 10), birthday: text(raw.birthday, 10),
    phoneCode: text(raw.phoneCode, 2), phone: text(raw.phone, 20).replace(/[\s\-()]/g, ''),
    over21: raw.over21 === true, terms: raw.terms === true
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

// Telr's payment page of the order, so a payment that can't be started (Telr refusing the
// order, ...) is reported on the form. null when the shop has no payment page for it (it answers
// with one of this site's own pages then).
async function paymentPage(ref: string): Promise<string | null> {
  const url = await payUrl(ref);
  if (!url) return null;
  return new URL(url).origin === new URL(shopConfig.publicUrl).origin ? null : url;
}

export async function POST(request: Request) {
  if (!shopConfig.event || !shopConfig.publicUrl) {
    console.error('checkout: SHOP_EVENT and SHOP_SITE_URL must be set');
    return NextResponse.json({ error: 'Online payment isn’t set up yet. Please contact us to complete your booking.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(function () { return null; });
    if (!body || !Array.isArray(body.items) || !body.items.length || typeof body.buyer !== 'object' || !body.buyer) {
      throw new CheckoutError('Your order is empty.');
    }

    const buyer = readBuyer(body.buyer);
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
      countryPhoneCode: country(buyer.phoneCode)!.dial,
      phoneNumber: buyer.phone,
      // the buyer's address, for the shop's limit on unpaid orders
      ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || ''
    };
    // left out when empty
    if (buyer.gender) form.gender = buyer.gender;
    if (buyer.birthday) form.age = buyer.birthday;

    body.items.slice(0, cfg.tickets.length).forEach(function (item: { id?: unknown; quantity?: unknown }, i: number) {
      const t = ticket(String(item && item.id));
      const quantity = Number(item && item.quantity);
      if (!t || t.soldOut || !catalog.tickets[t.id] || catalog.tickets[t.id].soldOut || !Number.isInteger(quantity) || quantity < 1 || quantity > cfg.maxPerTicket) {
        throw new CheckoutError('Your order has a ticket that isn’t available. Please review your tickets.');
      }
      if (!ids[t.name]) throw new CheckoutError(t.name + ' isn’t on sale at the moment. Please choose another ticket.');
      form['tickets[' + i + '][ticketId]'] = ids[t.name];
      form['tickets[' + i + '][quantity]'] = String(quantity);
    });

    const res = await buyTickets(form);
    if (res.status === '1' && res.orderId) {
      const page = await paymentPage(res.orderId);
      if (page) return NextResponse.json({ url: page });
      console.error('checkout: no payment page for', buyerCountry.name, res.orderId);
      throw new CheckoutError('Payment isn’t available for your order right now. You have not been charged. Please try again later.');
    }

    // the shop's messages are written for buyers (sold out, unfinished orders, ...)
    throw new CheckoutError(res && res.message ? String(res.message) : 'We couldn’t start the payment. Please try again in a moment.');
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('checkout:', e);
    return NextResponse.json({ error: 'We couldn’t start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
