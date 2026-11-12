import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import nextConfig, { CONTENT_SECURITY_POLICY, PAYMENT_PAGE_POLICY } from '../next.config';
import { MAINTENANCE_PATHS, proxy } from '../proxy';
import { allowed, allowlistVerdict, clientIp, parseAllowlist } from '../lib/ip-allowlist';

// the whole path against the pattern, as the proxy does
const showsMaintenance = function (path: string) {
  return new RegExp('^' + MAINTENANCE_PATHS + '$').test(path);
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
    expect(await nextConfig.rewrites!()).toEqual([{ source: '/privacy', destination: '/preregister/privacy.html' }]);
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

  it('leave the ticket shop open: this site\'s server, the bank check and the emails call it', function () {
    expect(showsMaintenance('/Api/Eventsnew/buyTickets')).toBe(false);
    expect(showsMaintenance('/shop/pay/CJ123')).toBe(false);
    expect(showsMaintenance('/shop/return/CJ123')).toBe(false);
    expect(showsMaintenance('/shop/email/hero.jpg')).toBe(false);
    expect(showsMaintenance('/shopping')).toBe(true);
  });

  it('leave the pre-registration page and its form open: that is what visitors get', function () {
    expect(showsMaintenance('/preregister/index.html')).toBe(false);
    expect(showsMaintenance('/preregister/assets/img/hero-yacht.webp')).toBe(false);
    expect(showsMaintenance('/api/preregister')).toBe(false);
    expect(showsMaintenance('/privacy')).toBe(false);
    expect(showsMaintenance('/privacy-x')).toBe(true);
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

describe('privacy notice', function () {
  it('is at /privacy, the old address sends there', async function () {
    expect(await nextConfig.rewrites!()).toContainEqual({ source: '/privacy', destination: '/preregister/privacy.html' });
    expect(await nextConfig.redirects!()).toContainEqual({ source: '/preregister/privacy.html', destination: '/privacy', permanent: true });
  });
});

describe('IP allowlist', function () {
  const visit = function (path: string, ip: string) {
    return proxy(new NextRequest('https://club.example.com' + path, { headers: { 'x-forwarded-for': ip } }));
  };

  it('lets everyone in while IP_ALLOWLIST is empty', function () {
    vi.stubEnv('IP_ALLOWLIST', '');
    expect(visit('/tickets', '198.51.100.1').status).toBe(200);
  });

  it('refuses every path, files and APIs included, to other addresses', async function () {
    vi.stubEnv('IP_ALLOWLIST', '203.0.113.7, 10.0.0.0/8, 2001:db8::/32');
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    vi.stubEnv('SALES_DASHBOARD', 'on');
    for (const path of ['/', '/tickets', '/admin', '/admin/login', '/api/checkout', '/api/preregister', '/Api/Eventsnew/buyTickets', '/shop/return/CJ1', '/_next/static/chunks/a.js', '/assets/fonts/Outfit.woff2', '/privacy']) {
      const r = visit(path, '198.51.100.1');
      expect(r.status, path).toBe(403);
      expect(await r.text()).toBe('Access denied.');
      expect(visit(path, '203.0.113.7').status, path).toBe(200);
    }
    expect(visit('/', '10.20.30.40').status).toBe(200);
    expect(visit('/', '11.0.0.1').status).toBe(403);
    expect(visit('/', '2001:db8:1::5').status).toBe(200);
    expect(visit('/', '2001:db9::5').status).toBe(403);
  });

  it('checks before maintenance mode', function () {
    vi.stubEnv('IP_ALLOWLIST', '203.0.113.7');
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    expect(visit('/', '198.51.100.1').status).toBe(403);
    expect(visit('/', '203.0.113.7').headers.get('x-middleware-rewrite')).toBe('https://club.example.com/preregister/index.html');
  });

  it('takes the address nginx added: the last X-Forwarded-For entry', function () {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.1' }))).toBe('198.51.100.1');
    // X-Real-IP is the client's to set when nginx doesn't: not used
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('');
    expect(allowlistVerdict(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '203.0.113.7' }), '203.0.113.7')).toBe(false);
    // a spoofed first entry doesn't help
    expect(allowlistVerdict(new Headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.1' }), '203.0.113.7')).toBe(false);
    expect(allowlistVerdict(new Headers({}), '203.0.113.7')).toBe(false);
    expect(allowlistVerdict(new Headers({}), '')).toBeNull();
  });

  it('reads addresses and ranges, IPv4 inside IPv6 too', function () {
    const r = parseAllowlist('127.0.0.1 ::1,192.168.1.0/24  fe80::/10 nonsense 1.2.3.4/40');
    expect(r).toHaveLength(4);
    expect(allowed('127.0.0.1', r)).toBe(true);
    expect(allowed('::ffff:127.0.0.1', r)).toBe(true);
    expect(allowed('::1', r)).toBe(true);
    expect(allowed('[::1]', r)).toBe(true);
    expect(allowed('192.168.1.255', r)).toBe(true);
    expect(allowed('192.168.2.1', r)).toBe(false);
    expect(allowed('fe80::1%eth0', r)).toBe(true);
    expect(allowed('1.2.3.4', r)).toBe(false);
    expect(allowed('not-an-ip', r)).toBe(false);
    expect(allowed('', r)).toBe(false);
  });
});

describe('sales dashboard switch', function () {
  const visit = function (path: string) {
    return proxy(new NextRequest('https://club.example.com' + path, { headers: { 'x-forwarded-for': '127.0.0.1' } }));
  };

  it('is closed without SALES_DASHBOARD=on: pages, sign-in, exports and its API answer 404', async function () {
    vi.stubEnv('SALES_DASHBOARD', '');
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    for (const path of ['/admin', '/admin/', '/admin/login', '/admin/export', '/admin/registrations/export', '/admin/orders/CJ1', '/shop/admin/login', '/shop/admin/stats']) {
      const r = visit(path);
      expect(r.status, path).toBe(404);
      expect(await r.text()).toBe('Not found.');
    }
    // the rest of the site and the ticket shop stay open
    for (const path of ['/', '/tickets', '/administration', '/shop/pay/CJ1', '/shop/return/CJ1', '/assets/img/logo.png']) expect(visit(path).status, path).toBe(200);
  });

  it('opens with SALES_DASHBOARD=on', function () {
    vi.stubEnv('SALES_DASHBOARD', 'on');
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    expect(visit('/admin/login').status).toBe(200);
    expect(visit('/shop/admin/stats').status).toBe(200);
  });
});

describe('security headers', function () {
  type Rule = { source: string; headers: { key: string; value: string }[] };
  const rulesFor = async function (path: string) {
    const rules = (await nextConfig.headers!()) as Rule[];
    // Next matches a source against the whole path, as path-to-regexp does with a custom group
    return rules.filter(function (r) {
      return r.source === '/:path*' || new RegExp('^' + r.source + '$').test(path);
    }).flatMap(function (r) { return r.headers.map(function (h) { return h.key; }); });
  };

  it('are sent on pages, APIs and the pre-registration page', async function () {
    for (const path of ['/', '/tickets', '/api/checkout', '/preregister/index.html', '/shop/pay/CJ1']) {
      const keys = await rulesFor(path);
      expect(keys).toEqual(expect.arrayContaining(['Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']));
    }
  });

  it('leave the CSP off the ticket server\'s files (PDF viewer)', async function () {
    for (const path of ['/booking_events/pdf/abc', '/downloadticketpdf/G-1', '/ticketing/download', '/uploads/qrcodes/T-1.png']) {
      const keys = await rulesFor(path);
      expect(keys).not.toContain('Content-Security-Policy');
      expect(keys).toContain('Strict-Transport-Security');
    }
  });

  it('allow nothing from other domains', function () {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:|\*/);
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it('hide X-Powered-By', function () {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  // the headers a path ends up with: Next applies the matching rules in order, a later one wins
  const effective = async function (path: string) {
    const rules = (await nextConfig.headers!()) as Rule[];
    const out: Record<string, string> = {};
    rules.forEach(function (r) {
      const re = new RegExp('^' + r.source.replace(/\/:path\*$/, '(?:/.*)?').replace(/:ref\b/g, '[^/]+') + '$');
      if (re.test(path)) r.headers.forEach(function (h) { out[h.key] = h.value; });
    });
    return out;
  };

  it('let Telr\'s card fields (script and frame) load on the payment page only', async function () {
    const pay = await effective('/pay/CJ123');
    expect(pay['Content-Security-Policy']).toBe(PAYMENT_PAGE_POLICY);
    expect(PAYMENT_PAGE_POLICY).toContain("script-src 'self' 'unsafe-inline' https://secure.telr.com");
    expect(PAYMENT_PAGE_POLICY).toContain("frame-src 'self' https://secure.telr.com");
    expect(PAYMENT_PAGE_POLICY).toContain("frame-ancestors 'none'");
    expect(pay['X-Frame-Options']).toBe('DENY');
    for (const path of ['/', '/summary', '/tickets', '/pay', '/pay/CJ1/x', '/thank-you']) {
      expect((await effective(path))['Content-Security-Policy'], path).toBe(CONTENT_SECURITY_POLICY);
    }
  });

  it('let only this site frame the bank check\'s return page', async function () {
    const ret = await effective('/shop/return/CJ123');
    expect(ret['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(ret['Content-Security-Policy']).toContain("frame-ancestors 'self'");
    expect(ret['Content-Security-Policy']).not.toMatch(/telr/);
    expect((await effective('/shop/pay/CJ123'))['X-Frame-Options']).toBe('DENY');
  });
});
