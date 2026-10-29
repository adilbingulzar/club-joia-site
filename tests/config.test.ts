import { describe, expect, it } from 'vitest';
import { CJ_CONFIG as cfg, gateway, gatewayFor, money, ticket } from '@/lib/config';

describe('gatewayFor', function () {
  it('suggests noon in the United Arab Emirates', function () {
    expect(gatewayFor('AE')).toBe('noon');
  });

  it('suggests Pay.nl in the Netherlands and Belgium', function () {
    expect(gatewayFor('NL')).toBe('paynl');
    expect(gatewayFor('BE')).toBe('paynl');
  });

  it('suggests MultiSafepay everywhere else', function () {
    expect(gatewayFor('PK')).toBe('multisafepay');
    expect(gatewayFor('US')).toBe('multisafepay');
    expect(gatewayFor('')).toBe('multisafepay');
  });
});

describe('gateway', function () {
  it('gives the engine as Alfred names it', function () {
    expect(gateway('noon')!.engine).toBe('noon');
    expect(gateway('multisafepay')!.engine).toBe('multisafe pay');
    expect(gateway('paynl')!.engine).toBe('paynl');
  });

  it('knows no other gateway', function () {
    expect(gateway('stripe')).toBeNull();
    expect(gateway('')).toBeNull();
  });
});

describe('money', function () {
  it('writes the currency and the amount with thousands separators', function () {
    expect(money(8000, 'AED')).toBe('AED 8,000');
    expect(money(10.5, 'USD')).toBe('USD 10.5');
  });
});

describe('tickets', function () {
  it('has one ticket per access level and day package', function () {
    expect(cfg.tickets).toHaveLength(cfg.tiers.length * cfg.packages.length);
    expect(new Set(cfg.tickets.map(function (t) { return t.id; })).size).toBe(cfg.tickets.length);
  });

  it('names tickets as Alfred does', function () {
    expect(ticket('ruby-red/3-days')!.name).toBe('Ruby Red, 3 days');
    expect(ticket('ultra-black/fri-sat')!.name).toBe('Ultra Black, Friday & Saturday');
    expect(ticket('nope')).toBeNull();
  });
});
