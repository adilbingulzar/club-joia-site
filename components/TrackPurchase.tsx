'use client';
import { useEffect } from 'react';

/*
 * A paid order on the thank-you page: reported to the ad platforms once per order and browser
 * (window.cjTrackPurchase from /tracking.js, lib/tracking.ts). The tags load on their own, so it
 * waits for them a few seconds; with the tags off nothing is sent.
 */
type Purchase = { ref: string; value: number; currency: string; items: number };

declare global {
  interface Window { cjTrackPurchase?: (p: Purchase) => void }
}

export default function TrackPurchase({ purchase }: { purchase: Purchase }) {
  useEffect(function () {
    const key = 'cj300-purchase-' + purchase.ref;
    try { if (localStorage.getItem(key)) return; } catch { /* storage off: Meta's event id still stops doubles */ }
    let tries = 0;
    const timer = setInterval(function () {
      if (window.cjTrackPurchase) {
        clearInterval(timer);
        window.cjTrackPurchase(purchase);
        try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
      } else if (++tries > 40) clearInterval(timer);
    }, 250);
    return function () { clearInterval(timer); };
  }, [purchase]);
  return null;
}
