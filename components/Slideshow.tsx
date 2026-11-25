'use client';
import { useEffect, useRef, useState } from 'react';

/*
 * Home page hero background: stills show for 1.5 s, videos play to the end, then the next slide.
 * Loops. Visitors who ask for reduced motion only see the first photo.
 * Only the first photo loads with the page; the rest wait until the page has loaded, then each slide loads
 * while the one before it shows.
 */
// wide: a landscape cut of a video, for screens where the hero's picture is wider than tall
type Slide = { src: string; wide?: string; video?: boolean; pos?: string };

const SLIDES: Slide[] = [
  { src: '/assets/slides/new/1.jpg', pos: '50% 62%' }, // yacht + F1
  { src: '/assets/slides/2026/party-1080x1440.mp4', wide: '/assets/slides/2026/party-1920x1080.mp4', video: true }, // party
  { src: '/assets/slides/new/3.jpg', pos: '75% 16%' }, // Black Coffee: face and name
  { src: '/assets/slides/2026/dining-1080x1440.mp4', wide: '/assets/slides/2026/dining-1920x1080.mp4', video: true }, // dining: steak, caviar
  { src: '/assets/slides/new/5.jpg', pos: '50% 35%' }, // guest
  { src: '/assets/slides/new/6.jpg', pos: '78% 18%' }, // Gordo: face and name (the name runs near the right edge)
  { src: '/assets/slides/2026/food-1080x1440.mp4', wide: '/assets/slides/2026/food-1920x1080.mp4', video: true }, // food skewers, chef
  { src: '/assets/slides/new/8.jpg', pos: '60% 50%' } // DJ
];
const STILL_MS = 1500;
// The hero's picture is 62% of the screen's width on desktop (globals.css), so it is wider than tall (4:3)
// only on very wide screens; phones and usual desktops get the portrait cut.
const WIDE = '(min-width: 821px) and (min-aspect-ratio: 43/20)';

export default function Slideshow() {
  const [on, setOn] = useState(0);
  const els = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);

  useEffect(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const list = els.current;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function prepare(n: number) {
      const el = list[n % list.length];
      if (el instanceof HTMLVideoElement && el.preload !== 'auto') {
        if (el.dataset.wide && window.matchMedia(WIDE).matches) el.src = el.dataset.wide; // the landscape cut on very wide screens
        el.preload = 'auto';
        el.load();
      }
      if (el instanceof HTMLImageElement && !el.getAttribute('src') && el.dataset.src) el.src = el.dataset.src;
    }
    function wait(ms: number) { clearTimeout(timer); timer = setTimeout(next, ms); }
    function show(n: number) {
      const prev = list[i];
      if (prev instanceof HTMLVideoElement) prev.pause();
      i = n % list.length;
      prepare(i); // in case the page was still loading when this slide came up
      setOn(i);
      prepare(i + 1); // start loading the next slide while this one shows
      const el = list[i];
      if (!(el instanceof HTMLVideoElement)) { wait(STILL_MS); return; }
      el.muted = true;
      el.currentTime = 0;
      const shown = i;
      el.play().catch(function () { if (i === shown) wait(STILL_MS); }); // autoplay blocked: treat as a still
      // safety net in case a video stalls and never fires "ended"
      wait(((isFinite(el.duration) && el.duration > 0 ? el.duration : 10) + 3) * 1000);
    }
    function next() { show(i + 1); }

    const done = list.map(function (el) {
      if (!(el instanceof HTMLVideoElement)) return null;
      const h = function () { if (list[i] === el) next(); };
      el.addEventListener('ended', h);
      el.addEventListener('error', h);
      return h;
    });
    // the next slide starts loading once the page (and the first photo) has loaded
    function start() { prepare(1); }
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    wait(STILL_MS);

    return function () {
      clearTimeout(timer);
      window.removeEventListener('load', start);
      list.forEach(function (el, k) {
        const h = done[k];
        if (!(el instanceof HTMLVideoElement)) return;
        el.pause();
        if (h) { el.removeEventListener('ended', h); el.removeEventListener('error', h); }
      });
    };
  }, []);

  return (
    <div className="slides" aria-hidden="true">
      {SLIDES.map(function (s, k) {
        const cls = 'slide' + (k === on ? ' on' : '');
        const ref = function (el: HTMLImageElement | HTMLVideoElement | null) { els.current[k] = el; };
        return s.video
          ? <video key={s.src} ref={ref} className={cls} src={s.src} data-wide={s.wide} muted playsInline preload="none" />
          : <img key={s.src} ref={ref} className={cls} src={k === 0 ? s.src : undefined} data-src={s.src} alt="" data-pos-desk="" style={{ '--pos': s.pos } as React.CSSProperties} />;
      })}
    </div>
  );
}
