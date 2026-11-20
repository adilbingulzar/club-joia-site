'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/*
 * Loads the ad platform tags (/tracking.js, lib/tracking.ts) once, on every page but the payment
 * page, and reports later page changes inside the site as visits.
 * Also counts every page view on this site's own database (/api/visit, lib/visits.ts), the payment
 * page included: the first page with where the visit came from, later ones as "internal".
 */
const PAYMENT_PAGE = /^\/pay\//;

declare global {
  interface Window { cjTrackPage?: () => void }
}

export default function Tracking() {
  const path = usePathname();
  const first = useRef(true);
  const counted = useRef(false);

  useEffect(function () {
    const later = counted.current;
    counted.current = true;
    const body = JSON.stringify(later
      ? { path: path, internal: true }
      : { path: path, query: location.search, referrer: document.referrer });
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/visit', body)) {
        fetch('/api/visit', { method: 'POST', body: body, keepalive: true }).catch(function () {});
      }
    } catch { /* counting never gets in the way */ }
  }, [path]);

  useEffect(function () {
    if (PAYMENT_PAGE.test(path)) return;
    if (!document.querySelector('script[src="/tracking.js"]')) {
      const s = document.createElement('script');
      s.src = '/tracking.js';
      s.async = true;
      document.head.appendChild(s);
      first.current = false;
      return;
    }
    if (first.current) { first.current = false; return; }
    window.cjTrackPage?.();
  }, [path]);

  return null;
}
