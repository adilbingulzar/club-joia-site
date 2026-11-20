import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../lib/csp';
import { trackingIds, trackingScript } from '../lib/tracking';
import { MAINTENANCE_PATHS } from '../proxy';

const ON = trackingIds({ META_PIXEL_ID: '1234567890', LINKEDIN_PARTNER_ID: '555', LINKEDIN_LEAD_CONVERSION_ID: '777' });
const OFF = trackingIds({});

describe('ad platform tags', function () {
  it('take digit ids only', function () {
    expect(ON).toEqual({ meta: '1234567890', linkedin: '555', linkedinLead: '777', linkedinPurchase: '' });
    expect(trackingIds({ META_PIXEL_ID: "1'); alert(1); ('", LINKEDIN_PARTNER_ID: ' 42 ' })).toEqual({ meta: '', linkedin: '42', linkedinLead: '', linkedinPurchase: '' });
  });

  it('starter: both platforms with the ids, a page change and a pre-registration', function () {
    const js = trackingScript(ON);
    expect(js).toContain("fbq('init', '1234567890');");
    expect(js).toContain("fbq('track', 'PageView');");
    expect(js).toContain('https://connect.facebook.net/en_US/fbevents.js');
    expect(js).toContain("window._linkedin_partner_id = '555';");
    expect(js).toContain('https://snap.licdn.com/li.lms-analytics/insight.min.js');
    expect(js).toContain("window.fbq('track', 'Lead')");
    expect(js).toContain("window.lintrk('track', { conversion_id: 777 })");
  });

  it('starter: a paid order as a purchase, with its value and an event id against doubles', function () {
    const js = trackingScript(trackingIds({ META_PIXEL_ID: '1', LINKEDIN_PARTNER_ID: '2', LINKEDIN_PURCHASE_CONVERSION_ID: '888' }));
    expect(js).toContain("window.fbq('track', 'Purchase', { value: p.value, currency: p.currency, num_items: p.items }, { eventID: 'purchase-' + p.ref })");
    expect(js).toContain("window.lintrk('track', { conversion_id: 888 })");
    expect(trackingScript(trackingIds({ META_PIXEL_ID: '1', LINKEDIN_PARTNER_ID: '2' }))).not.toContain('conversion_id');
  });

  it('starter when off: loads nothing, the hooks do nothing', function () {
    const js = trackingScript(OFF);
    expect(js).not.toMatch(/facebook|licdn|linkedin/);
    expect(js).toContain('window.cjTrackLead');
  });

  it('the policy lets the platforms in only while on, and never on the payment page', function () {
    const page = contentSecurityPolicy('n', '/tickets', false, ON);
    expect(page).toMatch(/script-src [^;]*https:\/\/connect\.facebook\.net[^;]*https:\/\/snap\.licdn\.com/);
    expect(page).toMatch(/img-src [^;]*https:\/\/www\.facebook\.com[^;]*https:\/\/px\.ads\.linkedin\.com/);
    expect(page).toMatch(/connect-src [^;]*https:\/\/px\.ads\.linkedin\.com/);
    expect(page).toMatch(/img-src [^;]*https:\/\/px4\.ads\.linkedin\.com/);
    expect(page).toMatch(/connect-src [^;]*https:\/\/px4\.ads\.linkedin\.com/);
    const pay = contentSecurityPolicy('n', '/pay/CJ1', false, ON);
    expect(pay).not.toMatch(/facebook|licdn|linkedin/);
    expect(contentSecurityPolicy('n', '/tickets', false, OFF)).not.toMatch(/facebook|licdn|linkedin/);
  });

  it('the starter stays reachable during maintenance (the pre-registration page loads it)', function () {
    expect(new RegExp('^' + MAINTENANCE_PATHS + '$').test('/tracking.js')).toBe(false);
  });
});
