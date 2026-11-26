"use client";

import { useNow } from "@/member/hooks/use-now";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** Live countdown to an ISO instant. Renders nothing until mounted (avoids hydration drift). */
export function Countdown({ target, label, liveLabel = "The weekend is live" }: { target: string; label: string; liveLabel?: string }) {
  const now = useNow(1000);

  if (now === null) return <div className="h-[68px]" aria-hidden />;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return (
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-pearl">
        <span className="size-2 animate-pulse rounded-full bg-ruby" aria-hidden />
        {liveLabel}
      </p>
    );
  }
  const p = parts(diff);
  const cells: [number, string][] = [
    [p.days, "Days"],
    [p.hours, "Hours"],
    [p.minutes, "Min"],
    [p.seconds, "Sec"],
  ];
  return (
    <div>
      <p className="sr-only">
        {label}: {p.days} days, {p.hours} hours and {p.minutes} minutes
      </p>
      <div className="grid grid-cols-4 gap-2" aria-hidden>
        {cells.map(([v, l]) => (
          <div key={l} className="rounded-xl border border-white/10 bg-black/25 px-2 py-2.5 text-center backdrop-blur-sm">
            <p className="font-display text-[28px] leading-none tabular-nums">{String(v).padStart(2, "0")}</p>
            <p className="mt-1.5 text-[9px] uppercase tracking-[0.22em] text-pearl-muted">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
