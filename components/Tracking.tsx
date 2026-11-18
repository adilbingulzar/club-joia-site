'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/*
 * Loads the ad platform tags (/tracking.js, lib/tracking.ts) once, on every page but the payment
 * page, and reports later page changes inside the site as visits.
 */
const PAYMENT_PAGE = /^\/pay\//;

declare global {
  interface Window { cjTrackPage?: () => void }
}

export default function Tracking() {
  const path = usePathname();
  const first = useRef(true);

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
