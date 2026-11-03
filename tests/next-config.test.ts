import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config';
import { config } from '../proxy';

// the same conversion as Next's for this matcher: the whole path against the one pattern
const gated = function (path: string) {
  return new RegExp('^' + config.matcher[0] + '$').test(path);
};

afterEach(function () {
  vi.unstubAllEnvs();
});

describe('ticket email paths', function () {
  it('come from the server holding the tickets', async function () {
    vi.stubEnv('ALFRED_UAE_URL', 'https://uae.example.com/');
    const rewrites = (await nextConfig.rewrites!()) as { source: string; destination: string }[];
    expect(rewrites).toContainEqual({ source: '/booking_events/pdf/:path', destination: 'https://uae.example.com/booking_events/pdf/:path' });
    expect(rewrites).toContainEqual({ source: '/assets/:path*', destination: 'https://uae.example.com/assets/:path*' });
  });

  it('are not served without that server', async function () {
    vi.stubEnv('ALFRED_UAE_URL', '');
    expect(await nextConfig.rewrites!()).toEqual([]);
  });

  it('stay open during the private preview', function () {
    expect(gated('/booking_events/pdf/abc')).toBe(false);
    expect(gated('/Ajaxdorian/getQrcodeImage/T-1')).toBe(false);
    expect(gated('/uploads/qrcodes/T-1.png')).toBe(false);
    expect(gated('/assets/images/events/a.png')).toBe(false);
    expect(gated('/ticketing/download')).toBe(false);
    expect(gated('/downloadticketpdf/G-1')).toBe(false);
  });

  it('leave the site itself behind the private preview', function () {
    expect(gated('/')).toBe(true);
    expect(gated('/tickets')).toBe(true);
    expect(gated('/api/checkout')).toBe(true);
    expect(gated('/assets/img/logo.png')).toBe(true);
  });
});
