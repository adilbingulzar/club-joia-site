import { describe, expect, it } from 'vitest';
import { convert, payCurrencies, payCurrency } from '../lib/currency';

describe('pay currencies', function () {
  it('offers AED next to USD, at the peg, per ticket in whole dirhams', function () {
    expect(payCurrencies('USD')).toEqual(['USD', 'AED']);
    expect(payCurrencies('AED')).toEqual(['AED']);
    expect(convert(7000, 'USD', 'AED')).toBe(25708);
    expect(convert(1200, 'USD', 'AED')).toBe(4407);
    expect(convert(7000, 'USD', 'USD')).toBe(7000);
    expect(function () { convert(100, 'AED', 'USD'); }).toThrow();
  });

  it('takes only a currency the shop can charge', function () {
    expect(payCurrency('USD', 'aed')).toBe('AED');
    expect(payCurrency('USD', 'EUR')).toBe('USD');
    expect(payCurrency('USD', undefined)).toBe('USD');
    expect(payCurrency('AED', 'USD')).toBe('AED');
  });
});
