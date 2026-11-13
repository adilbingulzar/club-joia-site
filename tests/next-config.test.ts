import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import nextConfig from '../next.config';
import { contentSecurityPolicy, TELR } from '../lib/csp';
import { breakOut, tellParent } from '../lib/shop/http';
import { MAINTENANCE_PATHS, proxy } from '../proxy';
import { allowed, allowlistVerdict, clientIp, parseAllowlist } from '../lib/ip-allowlist';

// the whole path against the pattern, as the proxy does
const showsMaintenance = function (path: string) {
  return new RegExp('^' + MAINTENANCE_PATHS + '$').test(path);
};

afterEach(function () {
  vi.unstubAllEnvs();
});

describe('maintenance paths', function () {
  it('send nothing to the old Alfred ticket server', async function () {
    expect(await nextConfig.rewrites!()).toEqual([{ source: '/privacy', destination: '/preregister/privacy.html' }]);
  });

  it('close the old Alfred ticket paths too', function () {
    expect(showsMaintenance('/booking_events/pdf/abc')).toBe(true);
    expect(showsMaintenance('/downloadticketpdf/G-1')).toBe(true);
  });

  it('close the site\'s fonts and the old dashboard paths (the dashboard is in the members app now)', function () {
    expect(showsMaintenance('/assets/fonts/Outfit.woff2')).toBe(true);
    expect(showsMaintenance('/admin')).toBe(true);
    expect(showsMaintenance('/admin/login')).toBe(true);
  });

  it('leave the site itself behind the maintenance page', function () {
    expect(showsMaintenance('/')).toBe(true);
    expect(showsMaintenance('/tickets')).toBe(true);
    expect(showsMaintenance('/api/checkout')).toBe(true);
    expect(showsMaintenance('/assets/img/cards/ruby-red.webp')).toBe(true);
    expect(showsMaintenance('/administration')).toBe(true);
  });

  it('leave the logo open (the browser tab\'s icon)', function () {
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
    for (const path of ['/', '/tickets', '/api/checkout', '/api/preregister', '/Api/Eventsnew/buyTickets', '/shop/return/CJ1', '/_next/static/chunks/a.js', '/assets/fonts/Outfit.woff2', '/privacy']) {
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
      expect(keys).toEqual(expect.arrayContaining(['Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']));
    }
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

  it('let only this site frame the bank check\'s return page', async function () {
    expect((await effective('/shop/return/CJ123'))['X-Frame-Options']).toBe('SAMEORIGIN');
    expect((await effective('/shop/pay/CJ123'))['X-Frame-Options']).toBe('DENY');
    expect((await effective('/pay/CJ123'))['X-Frame-Options']).toBe('DENY');
  });
});

describe('Content-Security-Policy', function () {
  const visit = function (path: string) {
    return proxy(new NextRequest('https://club.example.com' + path));
  };
  const nonceOf = function (policy: string) {
    return (/'nonce-([^']+)'/.exec(policy) || [])[1];
  };

  it('runs no inline script without a fresh nonce, on every response', async function () {
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    const seen = new Set<string>();
    for (const path of ['/', '/tickets', '/api/checkout', '/preregister/index.html', '/shop/pay/CJ1', '/assets/img/logo.png']) {
      const policy = visit(path).headers.get('content-security-policy') || '';
      const nonce = nonceOf(policy);
      expect(nonce, path).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      seen.add(nonce);
      expect(policy).toMatch(/script-src 'self' 'nonce-[^']+'(;| )/);
      expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    }
    expect(seen.size).toBe(6);
  });

  it('hands the same nonce to the page that renders (Next.js reads it from the request)', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'false');
    const res = visit('/tickets');
    const nonce = nonceOf(res.headers.get('content-security-policy') || '');
    // NextResponse.next({ request: { headers } }) passes request headers on as x-middleware-request-*
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(res.headers.get('x-middleware-request-content-security-policy')).toContain("'nonce-" + nonce + "'");
  });

  it('also with maintenance on, the pre-registration page and redirects included', function () {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    for (const path of ['/', '/tickets', '/api/checkout']) {
      expect(visit(path).headers.get('content-security-policy'), path).toMatch(/'nonce-/);
    }
    expect(visit('/').headers.get('x-middleware-request-x-nonce')).toBeTruthy();
  });

  it('allows nothing from other domains, except Telr on the payment page', function () {
    const policy = contentSecurityPolicy('abc', '/tickets', false);
    expect(policy).not.toMatch(/https?:|\*/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'nonce-abc';");

    const pay = contentSecurityPolicy('abc', '/pay/CJ123', false);
    expect(pay).toContain("script-src 'self' 'nonce-abc' " + TELR + ';');
    expect(pay).toContain("frame-src 'self' " + TELR);
    expect(pay).toContain("frame-ancestors 'none'");
    for (const path of ['/', '/summary', '/tickets', '/pay', '/pay/CJ1/x', '/thank-you', '/shop/return/CJ1']) {
      expect(contentSecurityPolicy('abc', path, false), path).not.toMatch(/telr/);
    }
    expect(contentSecurityPolicy('abc', '/tickets', true)).toContain("script-src 'self' 'nonce-abc' 'unsafe-eval';");
  });

  it('lets only this site frame the bank check\'s return page', function () {
    expect(contentSecurityPolicy('abc', '/shop/return/CJ123', false)).toContain("frame-ancestors 'self'");
    expect(contentSecurityPolicy('abc', '/shop/pay/CJ123', false)).toContain("frame-ancestors 'none'");
  });

  it('puts the nonce on the shop\'s own little pages', async function () {
    const out = await breakOut('https://club.example.com/thank-you', 'n0nce+/=').text();
    expect(out).toContain('<script nonce="n0nce+/=">');
    const framed = await tellParent('CJ1', 'pay_1', '/shop/return/CJ1?whole=1', 'xyz').text();
    expect(framed).toContain('<script nonce="xyz">');
    expect(await breakOut('/x').text()).toContain('<script>');
  });
});
