import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config';
import { config, proxy } from '../proxy';

// the same conversion as Next's for this matcher: the whole path against the one pattern
const showsMaintenance = function (path: string) {
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

  it('stay open during maintenance', function () {
    expect(showsMaintenance('/booking_events/pdf/abc')).toBe(false);
    expect(showsMaintenance('/Ajaxdorian/getQrcodeImage/T-1')).toBe(false);
    expect(showsMaintenance('/uploads/qrcodes/T-1.png')).toBe(false);
    expect(showsMaintenance('/assets/images/events/a.png')).toBe(false);
    expect(showsMaintenance('/ticketing/download')).toBe(false);
    expect(showsMaintenance('/downloadticketpdf/G-1')).toBe(false);
  });

  it('leave the site itself behind the maintenance page', function () {
    expect(showsMaintenance('/')).toBe(true);
    expect(showsMaintenance('/tickets')).toBe(true);
    expect(showsMaintenance('/api/checkout')).toBe(true);
    expect(showsMaintenance('/assets/img/logo.png')).toBe(true);
  });
});

describe('maintenance', function () {
  it('shows the page while MAINTENANCE_MODE is true', async function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    const response = proxy();
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('under maintenance');
  });

  it('leaves the site open otherwise', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    expect(proxy().status).toBe(200);
    vi.stubEnv('MAINTENANCE_MODE', '');
    expect(proxy().status).toBe(200);
  });
});
