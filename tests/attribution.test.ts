import { describe, expect, it } from 'vitest';
import { attributionFromCookies, checked, decodeAttribution, encodeAttribution, fromVisit } from '../lib/attribution';

const NOW = new Date('2026-11-18T10:00:00.000Z');

describe('ad campaign of a visit', function () {
  it('takes the utm tags and click ids, the page and the other site that sent it', function () {
    const url = new URL('https://clubjoia300.com/ruby-red?utm_source=facebook&utm_medium=paid&utm_campaign=gp-2026&fbclid=IwAR0abc&other=1');
    expect(fromVisit(url, 'https://l.facebook.com/l.php?u=x', NOW)).toEqual({
      utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'gp-2026', fbclid: 'IwAR0abc',
      landing: '/ruby-red', referrer: 'https://l.facebook.com/l.php', at: NOW.toISOString()
    });
  });

  it('knows Google, TikTok and LinkedIn click ids', function () {
    const url = new URL('https://clubjoia300.com/?gclid=g1&ttclid=t1&li_fat_id=l1');
    expect(fromVisit(url, null, NOW)).toEqual({ gclid: 'g1', ttclid: 't1', li_fat_id: 'l1', landing: '/', at: NOW.toISOString() });
  });

  it('is nothing for a visit without tags, and leaves out this site as the referrer', function () {
    expect(fromVisit(new URL('https://clubjoia300.com/tickets?x=1'), 'https://google.com/', NOW)).toBeNull();
    expect(fromVisit(new URL('https://clubjoia300.com/?utm_source=x'), 'https://clubjoia300.com/terms', NOW)).not.toHaveProperty('referrer');
    expect(fromVisit(new URL('https://clubjoia300.com/?utm_source=x'), 'not a url', NOW)).not.toHaveProperty('referrer');
  });

  it('cuts long values and drops control characters and empty tags', function () {
    const a = fromVisit(new URL('https://clubjoia300.com/?utm_source=' + 'a'.repeat(500) + '&utm_medium=%0Aab%00c&utm_term='), null, NOW)!;
    expect(a.utm_source).toHaveLength(200);
    expect(a.utm_medium).toBe('abc');
    expect(a).not.toHaveProperty('utm_term');
  });
});

describe('the campaign cookie', function () {
  it('reads back what it wrote', function () {
    const a = { utm_source: 'facebook', fbclid: 'IwAR0abc', landing: '/', at: NOW.toISOString() };
    expect(decodeAttribution(encodeAttribution(a))).toEqual(a);
    expect(attributionFromCookies('cj300-dev=k; cj300-src=' + encodeAttribution(a) + '; other=1')).toEqual(a);
  });

  it('ignores a missing, broken, oversized or foreign cookie', function () {
    expect(attributionFromCookies(null)).toBeNull();
    expect(attributionFromCookies('other=1')).toBeNull();
    expect(decodeAttribution('%%%')).toBeNull();
    expect(decodeAttribution(Buffer.from('[1,2]').toString('base64url'))).toBeNull();
    expect(decodeAttribution('a'.repeat(5000))).toBeNull();
  });

  it('keeps only the known fields, checked', function () {
    expect(checked({ utm_source: 'x', evil: '<script>', landing: 'javascript:alert(1)', referrer: 'ftp://x', at: 'yesterday' })).toEqual({ utm_source: 'x' });
    expect(checked({ landing: '/', at: NOW.toISOString() })).toBeNull();
    expect(checked({ utm_source: 5 })).toBeNull();
  });
});
