'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart, useHydrated, type Line } from '@/lib/cart';
import { CJ_CONFIG as cfg, gatewayFor } from '@/lib/config';
import { useCatalog } from '@/lib/prices';
import { countries, country } from '@/lib/countries';

function pageUrl(path: string) { return new URL(path, location.href).href; }

// The buyer details Alfred's own ticket shop asks for.
export type Buyer = {
  firstName: string; lastName: string; email: string; repeatEmail: string;
  address: string; zipcode: string; city: string; country: string; gender: string;
  day: string; month: string; year: string; phoneCode: string; phone: string;
  gateway: string; method: string; sms: boolean; terms: boolean;
};

export const EMPTY_BUYER: Buyer = {
  firstName: '', lastName: '', email: '', repeatEmail: '', address: '', zipcode: '', city: '',
  country: '', gender: '', day: '', month: '', year: '', phoneCode: '', phone: '', gateway: '', method: '', sms: false, terms: false
};

// The gateway's payment methods (app/api/checkout/methods) for gateway + country `key`.
type Method = { id: string; name: string; icon: string };
type Methods = { key: string; list: Method[]; loading: boolean; failed: boolean };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const thisYear = new Date().getFullYear();
const DAYS = Array.from({ length: 31 }, function (_, i) { return i + 1; });
const YEARS = Array.from({ length: thisYear - 1919 }, function (_, i) { return thisYear - i; });
const PHONE_CODES = countries.slice().sort(function (a, b) { return Number(a.dial) - Number(b.dial) || a.name.localeCompare(b.name); });

function pad(n: string) { return n.length < 2 ? '0' + n : n; }

// yyyy-mm-dd, or '' when the date doesn't exist (31 February).
export function birthday(b: Buyer): string {
  if (!b.day || !b.month || !b.year) return '';
  const s = b.year + '-' + pad(b.month) + '-' + pad(b.day);
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getTime() < Date.now() ? s : '';
}

type Field = 'firstName' | 'lastName' | 'email' | 'repeatEmail' | 'address' | 'zipcode' | 'city' | 'country' | 'gender' | 'birthday' | 'phone' | 'gateway' | 'method' | 'terms';

// In form order, so the first one is the one to scroll to.
const FIELDS: Field[] = ['firstName', 'lastName', 'email', 'repeatEmail', 'address', 'zipcode', 'city', 'country', 'gender', 'birthday', 'phone', 'gateway', 'method', 'terms'];

const NAME = /^[\p{L}\p{M}' .\-]+$/u;

// The same rules as app/api/checkout, with a message per field.
export function validate(b: Buyer, methods: Method[]): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const email = b.email.trim().toLowerCase();
  const phone = b.phone.replace(/[\s\-()]/g, '');

  if (!b.firstName.trim()) e.firstName = 'Please enter your first name.';
  else if (!NAME.test(b.firstName.trim())) e.firstName = 'Please use letters only.';
  if (!b.lastName.trim()) e.lastName = 'Please enter your last name.';
  else if (!NAME.test(b.lastName.trim())) e.lastName = 'Please use letters only.';
  if (!email) e.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Please enter a valid email address, like name@example.com.';
  if (!b.repeatEmail.trim()) e.repeatEmail = 'Please enter your email address again.';
  else if (b.repeatEmail.trim().toLowerCase() !== email) e.repeatEmail = 'The email addresses don’t match.';
  if (!b.address.trim()) e.address = 'Please enter your address.';
  if (!b.zipcode.trim()) e.zipcode = 'Please enter your zip code.';
  else if (!/^[A-Za-z0-9 \-]{2,20}$/.test(b.zipcode.trim())) e.zipcode = 'Please enter a valid zip code.';
  if (!b.city.trim()) e.city = 'Please enter your city.';
  if (!b.country) e.country = 'Please select your country.';
  if (!b.gender) e.gender = 'Please select your gender.';
  if (!b.day || !b.month || !b.year) e.birthday = 'Please select your full birthday.';
  else if (!birthday(b)) e.birthday = 'This date doesn’t exist. Please check the day and month.';
  if (!b.phoneCode) e.phone = 'Please select your country code.';
  else if (!phone) e.phone = 'Please enter your phone number.';
  else if (!/^\d{6,15}$/.test(phone)) e.phone = 'Please enter a valid phone number, digits only, without the country code.';
  if (!b.gateway) e.gateway = 'Please choose a payment method.';
  else if (methods.length && !methods.some(function (m) { return m.id === b.method; })) e.method = 'Please choose how you want to pay.';
  if (!b.terms) e.terms = 'Please agree to the terms and conditions.';
  return e;
}

// The control to focus for a field.
function controlId(f: Field, b: Buyer): string {
  if (f === 'birthday') return !b.day ? 'day' : !b.month ? 'month' : 'year';
  if (f === 'phone') return b.phoneCode ? 'phone' : 'phoneCode';
  if (f === 'gateway') return 'gateway-' + cfg.payment.gateways[0].id;
  if (f === 'method') return 'methods';
  return f;
}

function methodsKey(b: Buyer): string {
  return b.gateway && b.country ? b.gateway + ':' + b.country : '';
}

export default function Summary({ termsUrl, paymentFailed }: { termsUrl: string; paymentFailed: boolean }) {
  const cart = useCart();
  const catalog = useCatalog();
  const money = catalog.money;
  const hydrated = useHydrated();
  const lines = cart.lines;
  const n = cart.count;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const msgRef = useRef<HTMLParagraphElement>(null);
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);
  // A field's error shows once the buyer has left it, or for every field after a submit.
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [methods, setMethods] = useState<Methods>({ key: '', list: [], loading: false, failed: false });
  const key = methodsKey(buyer);
  const shownMethods = methods.key === key ? methods.list : [];
  // Also before the load has started for a new gateway or country.
  const methodsLoading = !!key && (methods.key !== key || methods.loading);
  const errors = validate(buyer, shownMethods);
  const smsFee = buyer.sms ? cfg.payment.smsFee : 0;

  function error(f: Field): string {
    return tried || touched[f] ? errors[f] || '' : '';
  }

  function touch(f: Field) {
    setTouched(function (t) { return t[f] ? t : { ...t, [f]: true }; });
  }

  function errorText(f: Field) {
    const text = error(f);
    return text ? <span className="field-error" id={f + '-error'}>{text}</span> : null;
  }

  function invalid(f: Field) {
    return error(f) ? { 'aria-invalid': true, 'aria-describedby': f + '-error' } : {};
  }

  // Reset the button if the visitor comes back from the payment page with the back button.
  useEffect(function () {
    function reset() { setBusy(false); }
    window.addEventListener('pageshow', reset);
    return function () { window.removeEventListener('pageshow', reset); };
  }, []);

  // Bring a new error into view, it sits under the long form.
  useEffect(function () {
    if (msg && msgRef.current) {
      msgRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      msgRef.current.focus({ preventScroll: true });
    }
  }, [msg]);

  // The methods of the chosen gateway for the buyer's country, with its suggested one selected.
  useEffect(function () {
    if (!key) return;
    let current = true;
    const [g, c] = key.split(':');
    setMethods({ key, list: [], loading: true, failed: false });
    fetch(cfg.payment.checkoutEndpoint + '/methods?' + new URLSearchParams({ gateway: g, country: c }), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data: { methods: Method[]; suggested: string }) {
        if (!current) return;
        setMethods({ key, list: data.methods || [], loading: false, failed: false });
        setBuyer(function (b) { return methodsKey(b) === key ? { ...b, method: data.suggested || '' } : b; });
      })
      .catch(function () {
        // Without the list the order goes with the suggested method (app/api/checkout).
        if (current) setMethods({ key, list: [], loading: false, failed: true });
      });
    return function () { current = false; };
  }, [key]);

  function set<K extends keyof Buyer>(key: K, value: Buyer[K]) {
    setBuyer(function (b) {
      const next = { ...b, [key]: value };
      // The phone code follows the country until the buyer picks one.
      if (key === 'country' && (!b.phoneCode || b.phoneCode === b.country)) next.phoneCode = value as string;
      // A country change selects its gateway, the buyer can pick another one after.
      if (key === 'country') next.gateway = value ? gatewayFor(value as string) : '';
      // The method list is the gateway's, it is loaded again.
      if (key === 'country' || key === 'gateway') next.method = '';
      return next;
    });
  }

  // maxLength as app/api/checkout cuts the fields
  function input(key: 'firstName' | 'lastName' | 'email' | 'repeatEmail' | 'address' | 'zipcode' | 'city' | 'phone', maxLength = 100) {
    return {
      id: key, name: key, value: buyer[key], required: true, maxLength, ...invalid(key),
      onChange: function (e: React.ChangeEvent<HTMLInputElement>) { set(key, e.target.value); },
      onBlur: function () { touch(key); }
    };
  }

  // The birthday and phone code selects belong to a group, their error shows after a submit
  // (or, for the code, once the phone number is left), not while the group is half filled in.
  function select(key: 'country' | 'gender' | 'day' | 'month' | 'year' | 'phoneCode') {
    const field: Field = key === 'phoneCode' ? 'phone' : key === 'country' || key === 'gender' ? key : 'birthday';
    return {
      id: key, name: key, value: buyer[key], required: true, ...invalid(field),
      onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { set(key, e.target.value); },
      onBlur: function () { if (key === 'country' || key === 'gender') touch(key); }
    };
  }

  function fail(text: string) {
    setMsg(text);
    setBusy(false);
  }

  function pay(e: React.FormEvent, lines: Line[]) {
    e.preventDefault();
    if (!lines.length || methodsLoading) return;
    setMsg('');
    setTried(true);

    const first = FIELDS.filter(function (f) { return errors[f]; })[0];
    if (first) {
      const el = document.getElementById(controlId(first, buyer));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
      return;
    }
    const dob = birthday(buyer);

    setBusy(true);
    fetch(cfg.payment.checkoutEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lines.map(function (l) { return { id: l.ticket.id, quantity: l.quantity }; }),
        buyer: {
          firstName: buyer.firstName, lastName: buyer.lastName, email: buyer.email, repeatEmail: buyer.repeatEmail,
          address: buyer.address, zipcode: buyer.zipcode, city: buyer.city, country: buyer.country,
          gender: buyer.gender, birthday: dob, phoneCode: buyer.phoneCode, phone: buyer.phone, gateway: buyer.gateway,
          method: buyer.method, sms: buyer.sms, terms: buyer.terms
        },
        successUrl: pageUrl('/thank-you'),
        cancelUrl: pageUrl('/summary')
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data.url) { location.href = data.url; return; }
        fail(data.error || 'We couldn’t start the payment. Please try again in a moment.');
      })
      .catch(function () { fail('We couldn’t start the payment. Please try again in a moment.'); });
  }

  return (
    <main className="wrap summary">
      <div className="page-title">
        <p className="eyebrow">Step 2 of 3 &nbsp;|&nbsp; Review</p>
        <h1>Order summary</h1>
        <p>Check your tickets, fill in your details and continue to secure payment.</p>
        {paymentFailed && <p className="alert error" role="alert">Your payment was not completed and you have not been charged. Please try again.</p>}
      </div>

      {/* Hidden until the stored cart has been read, as on the original site, and Alfred's prices are in. */}
      {hydrated && !catalog.ready && <div className="lines-loading" role="status">
        <span className="sr-only">Loading your order…</span>
        {[0, 1, 2].map(function (i) { return <i key={i} className="sk-row" aria-hidden="true"></i>; })}
      </div>}
      {hydrated && catalog.ready && !catalog.live && <div className="empty">
        <p className="alert error" role="alert">Ticket prices can’t be loaded right now. Your tickets are kept, please try again in a moment.</p>
      </div>}
      <div id="order" hidden={!hydrated || !catalog.live || !lines.length}>
        <table className="lines">
          <thead><tr><th scope="col">Ticket</th><th scope="col" className="num unit">Price</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Subtotal</th></tr></thead>
          <tbody id="lines">
            {lines.map(function (l) {
              return <tr key={l.ticket.id}><td className="item"><i className={'sw ' + l.ticket.swatch}></i><span>{l.ticket.name}<small>{l.ticket.pkg.dates}</small></span></td>
                <td className="num unit">{money(l.price)}</td>
                <td className="num">{l.quantity}</td>
                <td className="num">{money(l.subtotal)}</td></tr>;
            })}
          </tbody>
        </table>
        <dl className="totals">
          <div><dt>Tickets</dt><dd id="count">{n + (n === 1 ? ' ticket' : ' tickets')}</dd></div>
          {smsFee > 0 && <div><dt>Tickets via SMS</dt><dd>{money(smsFee)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd id="total">{money(cart.total + smsFee)}</dd></div>
        </dl>

        <form className="buyer" noValidate onSubmit={function (e) { pay(e, lines); }}>
          <h2>Your details</h2>
          <div className="fields">
            <label className={error('firstName') ? 'invalid' : ''}>First name<input {...input('firstName')} autoComplete="given-name" />{errorText('firstName')}</label>
            <label className={error('lastName') ? 'invalid' : ''}>Last name<input {...input('lastName')} autoComplete="family-name" />{errorText('lastName')}</label>
            <label className={error('email') ? 'invalid' : ''}>Email<input {...input('email', 150)} type="email" autoComplete="email" />{errorText('email')}</label>
            <label className={error('repeatEmail') ? 'invalid' : ''}>Repeat email<input {...input('repeatEmail', 150)} type="email" autoComplete="off" />{errorText('repeatEmail')}</label>
            <label className={'wide' + (error('address') ? ' invalid' : '')}>Address<input {...input('address', 200)} autoComplete="street-address" />{errorText('address')}</label>
            <label className={error('zipcode') ? 'invalid' : ''}>Zip code<input {...input('zipcode', 20)} autoComplete="postal-code" />{errorText('zipcode')}</label>
            <label className={error('city') ? 'invalid' : ''}>City<input {...input('city')} autoComplete="address-level2" />{errorText('city')}</label>
            <label className={error('country') ? 'invalid' : ''}>Country
              <select {...select('country')} autoComplete="country">
                <option value="">Select country</option>
                {countries.map(function (c) { return <option key={c.code} value={c.code}>{c.name}</option>; })}
              </select>
              {errorText('country')}
            </label>
            <label className={error('gender') ? 'invalid' : ''}>Gender
              <select {...select('gender')}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="nogender">Prefer not to say</option>
              </select>
              {errorText('gender')}
            </label>
            <fieldset className={'wide' + (error('birthday') ? ' invalid' : '')}>
              <legend>Birthday (dd/mm/yyyy)</legend>
              <div className="row">
                <select {...select('day')} aria-label="Day">
                  <option value="">dd</option>
                  {DAYS.map(function (d) { return <option key={d} value={d}>{pad(String(d))}</option>; })}
                </select>
                <select {...select('month')} aria-label="Month">
                  <option value="">mm</option>
                  {MONTHS.map(function (m, i) { return <option key={m} value={i + 1}>{pad(String(i + 1)) + ' - ' + m}</option>; })}
                </select>
                <select {...select('year')} aria-label="Year">
                  <option value="">yyyy</option>
                  {YEARS.map(function (y) { return <option key={y} value={y}>{y}</option>; })}
                </select>
              </div>
              {errorText('birthday')}
            </fieldset>
            <fieldset className={'wide' + (error('phone') ? ' invalid' : '')}>
              <legend>Phone number</legend>
              <div className="row phone">
                <select {...select('phoneCode')} aria-label="Country code">
                  <option value="">Code</option>
                  {PHONE_CODES.map(function (c) { return <option key={c.code} value={c.code}>{'+' + c.dial + ' ' + c.name}</option>; })}
                </select>
                <input {...input('phone', 20)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Phone number" aria-label="Phone number" />
              </div>
              {errorText('phone')}
            </fieldset>
            <fieldset className={'wide' + (error('gateway') ? ' invalid' : '')}>
              <legend>Payment method</legend>
              <div className="gateways">
                {cfg.payment.gateways.map(function (g) {
                  const suggested = !!buyer.country && gatewayFor(buyer.country) === g.id;
                  return <label key={g.id} className="gateway">
                    <input type="radio" id={'gateway-' + g.id} name="gateway" value={g.id} checked={buyer.gateway === g.id} {...invalid('gateway')} onChange={function () { set('gateway', g.id); }} />
                    <span>{g.name}{suggested && <small>{'Suggested for ' + country(buyer.country)!.name}</small>}</span>
                  </label>;
                })}
              </div>
              {errorText('gateway')}
            </fieldset>
            {key && <fieldset className={'wide' + (error('method') ? ' invalid' : '')} id="methods" tabIndex={-1} aria-busy={methodsLoading}>
              <legend>Pay with</legend>
              {methodsLoading && <div className="methods" role="status">
                <span className="sr-only">Loading payment options…</span>
                {[0, 1, 2].map(function (i) {
                  return <div key={i} className="method skeleton" aria-hidden="true"><i className="sk-radio"></i><i className="sk-icon"></i><i className="sk-text"></i></div>;
                })}
              </div>}
              {methods.failed && methods.key === key && <p className="methods-note">We couldn’t load the payment options. You can still continue, you’ll pay by card (iDEAL or Bancontact in the Netherlands or Belgium on Pay.nl).</p>}
              {!!shownMethods.length && <div className="methods">
                {shownMethods.map(function (m) {
                  return <label key={m.id} className="method">
                    <input type="radio" name="method" value={m.id} checked={buyer.method === m.id} {...invalid('method')} onChange={function () { set('method', m.id); }} />
                    <span className="method-icon">{m.icon && <img src={m.icon} alt="" width={40} height={40} loading="lazy" onError={function (e) { e.currentTarget.hidden = true; }} />}</span>
                    <span>{m.name}</span>
                  </label>;
                })}
              </div>}
              {errorText('method')}
            </fieldset>}
          </div>

          <label className="check">
            <input type="checkbox" checked disabled />
            <span>Receive my tickets on {buyer.email.trim() || 'my email'}</span>
          </label>
          <label className="check">
            <input type="checkbox" name="sms" checked={buyer.sms} onChange={function (e) { set('sms', e.target.checked); }} />
            <span>Also receive tickets via SMS ({money(cfg.payment.smsFee)})</span>
          </label>
          <label className={'check' + (error('terms') ? ' invalid' : '')}>
            <input type="checkbox" id="terms" name="terms" required checked={buyer.terms} {...invalid('terms')} onChange={function (e) { set('terms', e.target.checked); }} />
            <span>I agree to the <a href={termsUrl} target="_blank" rel="noopener">terms and conditions</a>.{errorText('terms')}</span>
          </label>

          <div className="actions">
            <Link className="btn-ghost" href="/tickets">Edit tickets</Link>
            <button className="btn" id="pay" type="submit" disabled={busy || methodsLoading}>{busy ? 'Redirecting…' : methodsLoading ? 'Loading payment options…' : 'Proceed to payment'}</button>
          </div>
          <p className="alert error" id="msg" role="alert" tabIndex={-1} ref={msgRef} hidden={!msg}>{msg}</p>
          <p className="note">
            You’ll be redirected to our payment provider to complete your purchase. Booking and payment fees, if any, are shown there. Ticket confirmation is sent by email after payment.
          </p>
        </form>
      </div>

      <div className="empty" id="empty" hidden={!hydrated || !catalog.live || !!lines.length}>
        <p>Your order is empty.</p>
        <Link className="btn" href="/tickets">Choose tickets</Link>
      </div>
    </main>
  );
}
