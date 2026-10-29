'use client';
/*
 * Alfred's prices, currency and sold out (lib/catalog) for client components. app/layout hands
 * over the catalogue as a promise, so pages don't wait for Alfred; until it has arrived
 * `ready` is false and prices show as loading.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { money, type Catalog } from './config';

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

export function useCatalog() {
  const c = useContext(CatalogContext);
  const live = !!c && c.live;
  return {
    ready: !!c,
    live: live, // false while loading or when Alfred couldn't be reached: nothing can be ordered
    price: function (id: string): number { return live && c!.tickets[id] && c!.tickets[id].price !== null ? c!.tickets[id].price! : 0; },
    soldOut: function (id: string): boolean { return !live || !c!.tickets[id] || c!.tickets[id].soldOut; },
    onSale: function (id: string): boolean { return live && !!c!.tickets[id] && c!.tickets[id].price !== null; },
    money: function (n: number): string { return money(n, c ? c.currency : ''); }
  };
}
