'use client';
import { useEffect, useState } from 'react';

const START = new Date('2026-12-04T00:00:00+04:00').getTime();

export default function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(function () {
    setNow(Date.now());
    const timer = setInterval(function () { setNow(Date.now()); }, 30000);
    return function () { clearInterval(timer); };
  }, []);

  let body: React.ReactNode = null;
  if (now !== null) {
    const d = START - now;
    if (d <= 0) {
      body = 'Race weekend is here';
    } else {
      const D = Math.floor(d / 864e5), H = Math.floor(d % 864e5 / 36e5), M = Math.floor(d % 36e5 / 6e4);
      body = <><div><b>{D}</b><i>days</i></div><div><b>{H}</b><i>hours</i></div><div><b>{M}</b><i>minutes</i></div></>;
    }
  }
  return <div className="cd" id="cd" aria-label="Countdown to December 4">{body}</div>;
}
