/* Cart shared by every page. Stored in sessionStorage so it survives page changes. */
import { useSyncExternalStore } from 'react';
import { CJ_CONFIG as cfg, ticket, type Ticket } from './config';

type CartData = Record<string, number>;
export type Line = { ticket: Ticket; quantity: number; subtotal: number };

const KEY = 'cj300-cart';
const EMPTY = '{}';
let memory = EMPTY; // fallback when storage is blocked
const listeners = new Set<() => void>();

// Raw JSON string: stable between calls, so React only re-renders on real changes.
function snapshot(): string {
  try { return sessionStorage.getItem(KEY) || EMPTY; } catch (e) { return memory; }
}
function parse(raw: string): CartData {
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}
function read(): CartData { return parse(snapshot()); }
function write(cart: CartData) {
  memory = JSON.stringify(cart);
  try { sessionStorage.setItem(KEY, memory); } catch (e) {}
  listeners.forEach(function (l) { l(); });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Re-sync if the visitor comes back with the browser's back button.
  window.addEventListener('pageshow', listener);
  return function () {
    listeners.delete(listener);
    window.removeEventListener('pageshow', listener);
  };
}

// Lines in catalogue order, ignoring unknown or sold-out tickets.
function linesOf(cart: CartData): Line[] {
  return cfg.tickets
    .filter(function (t) { return cart[t.id] > 0 && !t.soldOut; })
    .map(function (t) {
      const q = Math.min(cart[t.id], cfg.maxPerTicket);
      return { ticket: t, quantity: q, subtotal: q * t.price };
    });
}

export const Cart = {
  get: function (id: string): number { return read()[id] || 0; },
  set: function (id: string, qty: number) {
    const t = ticket(id);
    if (!t || t.soldOut) return;
    const cart = read();
    qty = Math.max(0, Math.min(cfg.maxPerTicket, qty | 0));
    if (qty) cart[id] = qty; else delete cart[id];
    write(cart);
  },
  clear: function () { write({}); }
};

/* The server (and the first client render) sees an empty cart; the stored cart is applied right after. */
export function useCart() {
  const cart = parse(useSyncExternalStore(subscribe, snapshot, function () { return EMPTY; }));
  const lines = linesOf(cart);
  return {
    get: function (id: string): number { return cart[id] || 0; },
    lines: lines,
    count: lines.reduce(function (s, l) { return s + l.quantity; }, 0),
    total: lines.reduce(function (s, l) { return s + l.subtotal; }, 0)
  };
}

const noop = function () { return function () {}; };
/* false during server render and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, function () { return true; }, function () { return false; });
}
