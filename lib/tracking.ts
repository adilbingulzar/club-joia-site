/*
 * Ad platform tags: the Meta Pixel and the LinkedIn Insight Tag, for the marketing team's ad
 * reporting (page visits, and a pre-registration as a conversion).
 *
 * On with META_PIXEL_ID and/or LINKEDIN_PARTNER_ID (numbers, from the ad accounts); off and nothing
 * loaded while both are empty. The site serves the starter itself at /tracking.js (app/tracking.js),
 * so no inline script is needed (lib/csp.ts): the pages load it (components/Tracking.tsx, and the
 * pre-registration page's own <script> tag), and it loads the platforms' scripts. The policy lets
 * those hosts in only while a tag is on, and never on the payment page (/pay/<ref>), where no
 * third-party script runs next to the card fields.
 *
 * window.cjTrackLead() reports a pre-registration (public/preregister/assets/app.js): Meta's "Lead"
 * event and, with LINKEDIN_LEAD_CONVERSION_ID, that LinkedIn conversion.
 * window.cjTrackPurchase() reports a paid order, on the thank-you page only when the order is paid
 * (components/TrackPurchase.tsx): Meta's "Purchase" with its value, and with
 * LINKEDIN_PURCHASE_CONVERSION_ID that LinkedIn conversion. Unpaid, declined or cancelled orders send none.
 */

export type TrackingIds = { meta: string; linkedin: string; linkedinLead: string; linkedinPurchase: string };

// ids are digits only; anything else counts as not set
function id(v: string | undefined): string {
  const s = (v || '').trim();
  return /^\d{1,25}$/.test(s) ? s : '';
}

export function trackingIds(env: Record<string, string | undefined> = process.env): TrackingIds {
  return {
    meta: id(env.META_PIXEL_ID), linkedin: id(env.LINKEDIN_PARTNER_ID),
    linkedinLead: id(env.LINKEDIN_LEAD_CONVERSION_ID), linkedinPurchase: id(env.LINKEDIN_PURCHASE_CONVERSION_ID)
  };
}

export const META_SCRIPT = 'https://connect.facebook.net';
export const META_PIXEL = 'https://www.facebook.com';
export const LINKEDIN_SCRIPT = 'https://snap.licdn.com';
export const LINKEDIN_PIXEL = 'https://px.ads.linkedin.com';
export const LINKEDIN_SYNC = 'https://www.linkedin.com'; // the pixel's redirect (li_sync)

/** The hosts each CSP directive needs for the tags that are on. */
export function trackingSources(ids: TrackingIds): { script: string[]; img: string[]; connect: string[] } {
  const s = { script: [] as string[], img: [] as string[], connect: [] as string[] };
  if (ids.meta) {
    s.script.push(META_SCRIPT);
    s.img.push(META_PIXEL);
    s.connect.push(META_PIXEL, META_SCRIPT);
  }
  if (ids.linkedin) {
    s.script.push(LINKEDIN_SCRIPT);
    s.img.push(LINKEDIN_PIXEL, LINKEDIN_SYNC);
    s.connect.push(LINKEDIN_PIXEL);
  }
  return s;
}

/** /tracking.js: the platforms' standard starters with this site's ids, or a no-op when off. */
export function trackingScript(ids: TrackingIds): string {
  const parts = ['/* Club JOIA 300: ad platform tags (lib/tracking.ts) */', '(function () {'];
  if (ids.meta) {
    parts.push(
      '  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};' +
        "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;" +
        "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','" + META_SCRIPT + "/en_US/fbevents.js');",
      "  fbq('init', '" + ids.meta + "');",
      "  fbq('track', 'PageView');"
    );
  }
  if (ids.linkedin) {
    parts.push(
      "  window._linkedin_partner_id = '" + ids.linkedin + "';",
      '  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];',
      '  window._linkedin_data_partner_ids.push(window._linkedin_partner_id);',
      '  (function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}' +
        "var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;" +
        "b.src='" + LINKEDIN_SCRIPT + "/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s)})(window.lintrk);"
    );
  }
  parts.push(
    '  // a page change inside the site (no new page load): Meta counts it as a visit',
    "  window.cjTrackPage = function () { if (window.fbq) window.fbq('track', 'PageView'); };",
    '  // a pre-registration sent',
    '  window.cjTrackLead = function () {',
    "    if (window.fbq) window.fbq('track', 'Lead');",
    ids.linkedin && ids.linkedinLead ? "    if (window.lintrk) window.lintrk('track', { conversion_id: " + ids.linkedinLead + ' });' : '',
    '  };',
    '  // a paid order (the thank-you page): its reference, value, currency and number of tickets',
    '  window.cjTrackPurchase = function (p) {',
    "    if (window.fbq) window.fbq('track', 'Purchase', { value: p.value, currency: p.currency, num_items: p.items }, { eventID: 'purchase-' + p.ref });",
    ids.linkedin && ids.linkedinPurchase ? "    if (window.lintrk) window.lintrk('track', { conversion_id: " + ids.linkedinPurchase + ' });' : '',
    '  };',
    '})();'
  );
  return parts.filter(Boolean).join('\n') + '\n';
}
