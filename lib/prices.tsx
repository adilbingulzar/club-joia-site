'use client';
/*
 * Alfred's prices, currency and sold out (lib/catalog) for client components. app/layout hands
 * over the catalogue as a promise, so pages don't wait for Alfred; until it has arrived
 * `ready` is false and prices show as loading.
 * Prices are in the currency the buyer picked (CurrencySwitch, kept in sessionStorage with the
 * cart), converted as the shop charges them (lib/currency.ts).
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { money, type Catalog } from './config';
import { convert, payCurrencies, payCurrency } from './currency';

const CatalogContext = createContext<Catalog | null>(null);

export function CatalogProvider({ catalog, children }: { catalog: Promise<Catalog>; children: React.ReactNode }) {
  const [value, setValue] = useState<Catalog | null>(null);
  useEffect(function () {
    let current = true;
    catalog.then(function (c) { if (current) setValue(c); });
    return function () { current = false; };
  }, [catalog]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

// ─── The buyer's currency ───

const KEY = 'cj300-currency';
let memory = ''; // fallback when storage is blocked
const listeners = new Set<() => void>();

function stored(): string {
  try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return memory; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return function () { listeners.delete(listener); };
}

export function setCurrency(currency: string) {
  memory = currency;
  try { sessionStorage.setItem(KEY, currency); } catch (e) {}
  listeners.forEach(function (l) { l(); });
}

export function useCatalog() {
  const c = useContext(CatalogContext);
  const live = !!c && c.live;
  const base = c ? c.currency : '';
  // the server (and the first client render) sees the shop's own currency
  const currency = payCurrency(base, useSyncExternalStore(subscribe, stored, function () { return ''; }));
  return {
    ready: !!c,
    live: live, // false while loading or when Alfred couldn't be reached: nothing can be ordered
    currency: currency,
    currencies: live ? payCurrencies(base) : [],
    price: function (id: string): number { return live && c!.tickets[id] && c!.tickets[id].price !== null ? convert(c!.tickets[id].price!, base, currency) : 0; },
    soldOut: function (id: string): boolean { return !live || !c!.tickets[id] || c!.tickets[id].soldOut; },
    onSale: function (id: string): boolean { return live && !!c!.tickets[id] && c!.tickets[id].price !== null; },
    money: function (n: number): string { return money(n, c ? currency : ''); },
    // a ticket's price in dirhams, to show under the dollar price; '' when it is shown in dirhams already
    aed: function (id: string): string {
      return live && currency !== 'AED' && payCurrencies(base).indexOf('AED') >= 0 && c!.tickets[id] && c!.tickets[id].price !== null
        ? money(convert(c!.tickets[id].price!, base, 'AED'), 'AED') : '';
    }
  };
}

/* USD | AED, when the order can be paid in more than one currency. */
export function CurrencySwitch() {
  const catalog = useCatalog();
  if (catalog.currencies.length < 2) return null;
  return (
    <div className="currency-switch" role="group" aria-label="Currency">
      <span>Pay in</span>
      {catalog.currencies.map(function (cur) {
        return <button type="button" key={cur} aria-pressed={cur === catalog.currency} onClick={function () { setCurrency(cur); }}>{cur}</button>;
      })}
    </div>
  );
}
