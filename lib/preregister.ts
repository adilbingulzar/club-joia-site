/*
 * The pre-registration page (public/preregister, shown at / during maintenance): its form's
 * checks, saving and emails. Was register.php of the CJ300_PreRegistration package, now on this
 * site's database (pre_registrations, see lib/shop/db.ts).
 *
 * Spam protection, as there: a hidden field bots fill in, a minimum time to fill in the form, only
 * from this site's own page, and 5 submissions per hour per connection (an anonymised code, the
 * IP address itself is never stored). A repeat with the same email updates the earlier one.
 */
import crypto from 'node:crypto';
import { db } from './shop/db';
import { send } from './shop/email';
import { shopConfig } from './shop/config';
import { preregisterGuest, preregisterTeam, type PreRegistration } from './shop/templates';

export const TIERS = ['Ruby Red', 'Pearly White', 'Ultra Black', 'Not sure yet'];
const PER_HOUR = 5;
const MIN_FILL_MS = 3000;

export type Reply = { status: number; body: { ok: boolean; error?: string; fields?: Record<string, string> } };

function clean(v: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return String(typeof v === 'string' ? v : '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max);
}

// anonymised connection code: HMAC of the address with a key derived from SHOP_ADMIN_KEY
function ipHash(ip: string): string {
  const key = crypto.createHmac('sha256', String(process.env.SHOP_ADMIN_KEY || '')).update('cj300 preregister').digest();
  return crypto.createHmac('sha256', key).update(ip || 'unknown').digest('hex');
}

export type Submission = { form: Record<string, string>; ip: string; userAgent: string };

export async function preregister(s: Submission): Promise<Reply> {
  const f = s.form;
  // Bots: hidden field filled in, or sent faster than a person could fill it. Pretend success.
  const started = Number(f.started || 0);
  if (f.website || (started > 0 && Date.now() - started < MIN_FILL_MS)) return { status: 200, body: { ok: true } };

  const r = {
    first_name: clean(f.first_name, 80),
    last_name: clean(f.last_name, 80),
    email: clean(f.email, 190).toLowerCase(),
    phone: clean(f.phone, 32),
    country: clean(f.country, 80),
    tier_interest: clean(f.tier_interest, 20),
    source: clean(f.source, 120),
    message: clean(f.message, 1000),
    marketing: f.marketing !== undefined && f.marketing !== ''
  };
  const consent = f.consent !== undefined && f.consent !== '';

  const errors: Record<string, string> = {};
  if (!r.first_name) errors.first_name = 'Please enter your first name.';
  if (!r.last_name) errors.last_name = 'Please enter your last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email)) errors.email = 'Please enter a valid email address.';
  if (!/^\+?[\d\s().-]{7,32}$/.test(r.phone) || r.phone.replace(/\D/g, '').length < 7) errors.phone = 'Please enter your mobile number, including the country code.';
  if (!r.country) errors.country = 'Please enter your country of residence.';
  if (TIERS.indexOf(r.tier_interest) < 0) errors.tier_interest = 'Please choose a membership.';
  if (!consent) errors.consent = 'Please agree so we can contact you about your pre-registration.';
  if (Object.keys(errors).length) return { status: 422, body: { ok: false, error: 'Please check the highlighted fields.', fields: errors } };

  let updated = false;
  try {
    const ip = ipHash(s.ip);
    await db.query('DELETE FROM shop.registration_attempts WHERE at < NOW(3) - INTERVAL 1 HOUR');
    const n = Number((await db.query('SELECT COUNT(*) AS n FROM shop.registration_attempts WHERE ip_hash = $1', [ip])).rows[0].n);
    if (n >= PER_HOUR) return { status: 429, body: { ok: false, error: 'Too many attempts from this connection. Please try again in an hour.' } };
    await db.query('INSERT INTO shop.registration_attempts (ip_hash) VALUES ($1)', [ip]);

    // affectedRows: 1 a new row, 2 an earlier one updated (updated_at always changes)
    const saved = await db.query(
      `INSERT INTO pre_registrations (email, first_name, last_name, phone, country, tier_interest, source, message, marketing_opt_in, consent_at, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(3), $10, $11) AS n
       ON DUPLICATE KEY UPDATE first_name = n.first_name, last_name = n.last_name, phone = n.phone, country = n.country,
         tier_interest = n.tier_interest, source = n.source, message = n.message, marketing_opt_in = n.marketing_opt_in,
         consent_at = n.consent_at, ip_hash = n.ip_hash, user_agent = n.user_agent, updated_at = NOW(3)`,
      [r.email, r.first_name, r.last_name, r.phone, r.country, r.tier_interest, r.source || null, r.message || null, r.marketing, ip, s.userAgent.slice(0, 255)]
    );
    updated = saved.affectedRows === 2;
  } catch (e) {
    console.error('[preregister]', e);
    return { status: 500, body: { ok: false, error: 'Something went wrong on our side. Please try again in a moment.' } };
  }

  // Emails are best-effort: the registration is saved already. The same design as the shop's emails.
  const mail: PreRegistration = {
    firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone, country: r.country,
    tier: r.tier_interest, source: r.source, message: r.message, marketing: r.marketing,
    consentAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  };
  const support = shopConfig.supportPhone();
  const team = String(process.env.PREREG_NOTIFY_EMAIL || '').trim();
  if (team) await send(team, preregisterTeam(mail, updated, support));
  if (process.env.PREREG_SEND_CONFIRMATION !== '0') await send(r.email, preregisterGuest(mail, support));
  return { status: 200, body: { ok: true } };
}
