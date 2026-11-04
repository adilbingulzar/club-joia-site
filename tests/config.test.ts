import { describe, expect, it } from 'vitest';
import { CJ_CONFIG as cfg, money, ticket } from '@/lib/config';

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

  it('sells every access level for 3 days, Friday & Sunday and Friday & Saturday only', function () {
    expect(cfg.packages.map(function (p) { return p.id; })).toEqual(['3-days', 'fri-sun', 'fri-sat']);
    expect(ticket('ruby-red/sat-sun')).toBeNull();
  });
});
