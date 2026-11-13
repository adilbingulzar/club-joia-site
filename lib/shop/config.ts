/*
 * Settings of the ticket shop's APIs (app/Api, app/shop), from the environment. Read when used, so
 * tests can set them first. See README, "Ticket shop".
 */
function url(v: string | undefined): string {
  return String(v || '').trim().replace(/\/+$/, '');
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

export const shopConfig = {
  // the event on sale, by its slug in the database (events.slug)
  get event() { return env('SHOP_EVENT'); },
  get currency() { return (env('SHOP_CURRENCY') || 'USD').toUpperCase(); },
  // this site: the buyer comes back to its /thank-you and /payment/<status> pages
  get siteUrl() { return url(process.env.SHOP_SITE_URL); },
  // where the buyer's bank check returns (IFZA's registered return domain) and the emails reach
  // these APIs, default the site
  get publicUrl() { return url(process.env.SHOP_PUBLIC_URL) || url(process.env.SHOP_SITE_URL); },
  // where the emails load their images (logo.png, hero.jpg), default this site's /shop/email
  // "Alternative payment option" in the email after a failed payment, default the tickets page
  get altPaymentUrl() { return url(process.env.SHOP_ALT_PAYMENT_URL) || this.siteUrl + '/tickets'; },
  // the phone in the emails, else the event's support phone (members app: Admin > Events)
  supportPhone(event?: { metadata?: { supportPhone?: string } | null } | null): string {
    return (env('SHOP_SUPPORT_PHONE') || String((event && event.metadata && event.metadata.supportPhone) || '')).trim();
  },
  // the sales dashboard's days
  get timezone() { return env('SHOP_TIMEZONE') || 'Asia/Dubai'; },
  // decrypts the admins' authenticator secrets (two-factor sign-in): the members app's same setting
  get mfaKey() { return env('MFA_ENCRYPTION_KEY'); },
  maxPerTicket: 10,
  // an unpaid order keeps its tickets out of stock this long
  holdMinutes: 30,

  // card payments through IFZA (lib/shop/ifza.ts)
  ifza: {
    // issued by IFZA (ifza_ik_live_...): server only, never in the browser
    get apiKey() { return env('IFZA_API_KEY'); },
    // IFZA, IFZA-Test, Elixium-Events or Elixium-Events-Test (a -Test store while the key is in test mode)
    get store() { return env('IFZA_STORE'); },
    // only for tests against a stand-in server
    get url() { return url(process.env.IFZA_URL) || 'https://world.ifza.com'; },
    // IFZA allows 100 create + checkout calls per 15 minutes per key: this site stops below that, so
    // nobody can use them all up (lib/shop/ifza.ts)
    get maxCallsPer15Min() { return Number(env('IFZA_MAX_CALLS')) || 90; }
  },

  email: {
    // "postmark" or "smtp" sends, anything else only writes the email to the log
    get driver() { return env('EMAIL_DRIVER') || 'console'; },
    get from() { return env('EMAIL_FROM'); },
    get smtpUrl() { return env('SMTP_URL'); },
    get postmarkToken() { return env('POSTMARK_SERVER_TOKEN'); },
    get postmarkStream() { return env('POSTMARK_MESSAGE_STREAM') || 'outbound'; }
  }
};
