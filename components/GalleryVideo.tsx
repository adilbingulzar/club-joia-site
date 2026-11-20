'use client';
import { useEffect, useRef, useState } from 'react';

/*
 * A short silent highlights clip that loops like a moving photo; with reduced motion it shows a play button instead.
 * Only the poster loads with the page: the clip starts loading just before it scrolls into view, plays while on
 * screen and pauses when it leaves.
 */
export default function GalleryVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(function () {
    const v = ref.current;
    if (!v) return;
    const reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStill(reduce);
    if (reduce) return;
    if (!('IntersectionObserver' in window)) { v.play().catch(function () {}); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) v.play().catch(function () {});
        else v.pause();
      });
    }, { rootMargin: '300px 0px' });
    io.observe(v);
    return function () { io.disconnect(); };
  }, []);
  return <video ref={ref} src={src} poster={poster} aria-label={label} muted loop playsInline preload="none" controls={still} />;
}
