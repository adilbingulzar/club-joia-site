'use client';
import { useEffect, useRef, useState } from 'react';

/* A short silent highlights clip that loops like a moving photo; with reduced motion it shows a play button instead. */
export default function GalleryVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(function () {
    const reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStill(reduce);
    if (!reduce && ref.current) ref.current.play().catch(function () {});
  }, []);
  return <video ref={ref} src={src} poster={poster} aria-label={label} muted loop playsInline preload="metadata" controls={still} />;
}
