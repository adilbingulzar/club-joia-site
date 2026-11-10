import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
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
    expect(showsMaintenance('/assets/img/cards/ruby-red.webp')).toBe(true);
    expect(showsMaintenance('/administration')).toBe(true);
  });

  it('leave the sales dashboard and its logo open, it has its own sign-in', function () {
    expect(showsMaintenance('/admin')).toBe(false);
    expect(showsMaintenance('/admin/login')).toBe(false);
    expect(showsMaintenance('/admin/orders/CJ123')).toBe(false);
    expect(showsMaintenance('/assets/img/logo.png')).toBe(false);
  });

  it('leave the ticket shop open: this site\'s server, Telr and the emails call it', function () {
    expect(showsMaintenance('/Api/Eventsnew/buyTickets')).toBe(false);
    expect(showsMaintenance('/shop/pay/CJ123')).toBe(false);
    expect(showsMaintenance('/shop/telr/advice')).toBe(false);
    expect(showsMaintenance('/shop/email/hero.jpg')).toBe(false);
    expect(showsMaintenance('/shopping')).toBe(true);
  });

  it('leave the pre-registration page and its form open: that is what visitors get', function () {
    expect(showsMaintenance('/preregister/index.html')).toBe(false);
    expect(showsMaintenance('/preregister/assets/img/hero-yacht.webp')).toBe(false);
    expect(showsMaintenance('/api/preregister')).toBe(false);
    expect(showsMaintenance('/api/preregisters')).toBe(true);
  });
});

describe('maintenance', function () {
  const visit = function (path: string, cookie = '') {
    return proxy(new NextRequest('https://club.example.com' + path, { headers: cookie ? { cookie } : {} }));
  };

  // a page that sends the visitor to the pre-registration page at /
  const closed = function (r: Response) {
    return r.status === 307 && r.headers.get('location') === 'https://club.example.com/';
  };

  it('shows the pre-registration page at / while MAINTENANCE_MODE is true, and sends every page there', async function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    const home = visit('/');
    expect(home.status).toBe(200);
    expect(home.headers.get('x-middleware-rewrite')).toBe('https://club.example.com/preregister/index.html');
    expect(closed(visit('/tickets'))).toBe(true);
    expect(closed(visit('/summary?x=1'))).toBe(true);
    const api = visit('/api/checkout');
    expect(api.status).toBe(503);
    expect(await api.text()).toContain('under maintenance');
  });

  it('leaves the site open otherwise', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    expect(visit('/tickets').status).toBe(200);
    vi.stubEnv('MAINTENANCE_MODE', '');
    expect(visit('/tickets').status).toBe(200);
  });

  it('opens the site for a developer with the key, without the key in the address', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    vi.stubEnv('MAINTENANCE_KEY', 'secret');
    const response = visit('/tickets?dev=secret');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://club.example.com/tickets');
    expect(response.cookies.get('cj300-dev')?.value).toBe('secret');
    expect(visit('/tickets', 'cj300-dev=secret').status).toBe(200);
  });

  it('keeps the page for a wrong key or cookie', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    vi.stubEnv('MAINTENANCE_KEY', 'secret');
    expect(closed(visit('/tickets?dev=wrong'))).toBe(true);
    expect(closed(visit('/tickets', 'cj300-dev=wrong'))).toBe(true);
  });

  it('opens for nobody without a key', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    vi.stubEnv('MAINTENANCE_KEY', '');
    expect(closed(visit('/tickets?dev='))).toBe(true);
    expect(closed(visit('/tickets', 'cj300-dev='))).toBe(true);
  });
});
