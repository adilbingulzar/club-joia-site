import { describe, expect, it } from 'vitest';
import { isBot, pageOf, sourceOf, uaeDay, visitorCode } from '../lib/visits';
import { MAINTENANCE_PATHS } from '../proxy';

const HOST = 'clubjoia300.com';

describe('visits', () => {
  it('counts the day in UAE time', () => {
    expect(uaeDay(new Date('2026-11-20T19:59:59Z'))).toBe('2026-11-20');
    expect(uaeDay(new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');
  });

  it('names the pages, without query or order refs', () => {
    expect(pageOf('/')).toBe('/');
    expect(pageOf('/tickets?x=1')).toBe('/tickets');
    expect(pageOf('/ruby-red/')).toBe('/ruby-red');
    expect(pageOf('/pay/CJMWJGKN4AYNSKLK')).toBe('/pay');
    expect(pageOf('/payment/success')).toBe('/payment');
    expect(pageOf('/preregister/index.html')).toBe('/preregister');
    expect(pageOf('/wp-admin.php')).toBe('other');
    expect(pageOf(42)).toBe('other');
  });

  it('finds where a visit came from', () => {
    expect(sourceOf('?utm_source=Instagram&utm_medium=story', '', HOST)).toBe('instagram');
    expect(sourceOf('?fbclid=abc', 'https://l.facebook.com/', HOST)).toBe('facebook');
    expect(sourceOf('?li_fat_id=1', '', HOST)).toBe('linkedin');
    expect(sourceOf('?gclid=1', '', HOST)).toBe('google');
    expect(sourceOf('', 'https://l.instagram.com/?u=x', HOST)).toBe('instagram');
    expect(sourceOf('', 'https://www.google.ae/', HOST)).toBe('google');
    expect(sourceOf('', 'https://lnkd.in/abc', HOST)).toBe('linkedin');
    expect(sourceOf('', 'https://news.example.org/post', HOST)).toBe('news.example.org');
    expect(sourceOf('', 'https://clubjoia300.com/tickets', HOST)).toBe('direct');
    expect(sourceOf('', '', HOST)).toBe('direct');
    expect(sourceOf('', 'not a url', HOST)).toBe('direct');
  });

  it('leaves out bots and page testers', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('Mozilla/5.0 ... Chrome-Lighthouse')).toBe(true);
    expect(isBot('facebookexternalhit/1.1')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('gives one visitor one code a day, a new one the next day', () => {
    const a = visitorCode('2026-11-20', '1.2.3.4', 'Safari');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorCode('2026-11-20', '1.2.3.4', 'Safari')).toBe(a);
    expect(visitorCode('2026-11-21', '1.2.3.4', 'Safari')).not.toBe(a);
    expect(visitorCode('2026-11-20', '1.2.3.5', 'Safari')).not.toBe(a);
  });

  it('keeps counting the pre-registration page during maintenance', () => {
    expect(new RegExp('^' + MAINTENANCE_PATHS + '$').test('/api/visit')).toBe(false);
  });
});
