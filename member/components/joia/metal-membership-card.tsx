"use client";

import { useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { cardTheme, type CardTheme } from "@/member/styles/design-tokens";
import { cn } from "@/member/lib/utils";
import { JoiaLogo } from "./joia-logo";

export type MembershipCardData = {
  name: string;
  membershipNumber: string;
  tierName: string;
  theme: CardTheme | string;
  memberSince: string; // pre-formatted
  status: string; // e.g. "Active"
  statusOk: boolean;
  validity?: string | null;
  chapter?: string | null;
  supportContact?: string | null;
  termsUrl?: string | null;
};

/**
 * Premium metal membership card. Brushed-metal texture, a slow sheen, and a light that follows
 * the pointer/finger. Tap (or the button) flips to the back. Respects prefers-reduced-motion.
 * Only non-sensitive data is printed on the card.
 */
export function MetalMembershipCard({
  data,
  flippable = true,
  size = "full",
  className,
}: {
  data: MembershipCardData;
  flippable?: boolean;
  size?: "full" | "compact";
  className?: string;
}) {
  const t = cardTheme(data.theme);
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--lx", `${x * 100}%`);
    el.style.setProperty("--ly", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
  }
  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  const face = "absolute inset-0 overflow-hidden rounded-[18px] [backface-visibility:hidden]";
  const compact = size === "compact";

  return (
    <div className={cn("w-full [perspective:1400px]", className)}>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative aspect-[1.586/1] w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))", transformStyle: "preserve-3d" }}
      >
        <div
          className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          {/* FRONT */}
          <section
            aria-label={`${data.tierName} membership card`}
            className={cn(face, "shadow-card")}
            style={{ background: t.base, color: t.text, boxShadow: `inset 0 0 0 1px ${t.edge}, var(--shadow-card)` }}
          >
            <div className="metal-texture absolute inset-0" aria-hidden />
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: `radial-gradient(circle at var(--lx,30%) var(--ly,20%), rgba(255,255,255,0.22), transparent 45%)` }}
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="animate-sheen absolute -inset-y-4 -inset-x-1/2" style={{ background: t.sheen }} />
            </div>

            <div className={cn("relative flex h-full flex-col justify-between", compact ? "p-4" : "p-5 sm:p-7")}>
              <div className="flex items-start justify-between">
                {/* Official black logo; the Ultra Black card uses the white/red one so it stays visible. */}
                <JoiaLogo variant={data.theme === "black" ? "white-red" : "black"} width={compact ? 100 : 128} />
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.32em]" style={{ color: t.subtle }}>
                    Membership
                  </p>
                  <p className={cn("font-display tracking-[0.12em]", compact ? "text-sm" : "text-base sm:text-lg")}>{data.tierName.toUpperCase()}</p>
                </div>
              </div>

              {/* Metal chip */}
              <div
                aria-hidden
                className={cn("rounded-[5px]", compact ? "h-6 w-8" : "h-8 w-11")}
                style={{
                  background: "linear-gradient(135deg,#d8dbe0 0%,#9fa4ab 40%,#e9ebee 60%,#8e9299 100%)",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                }}
              />

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("truncate font-display", compact ? "text-lg" : "text-xl sm:text-2xl")}>{data.name}</p>
                  <p className="mt-1 font-mono text-[11px] tracking-[0.22em] sm:text-xs" style={{ color: t.subtle }}>
                    {data.membershipNumber}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] uppercase tracking-[0.24em]" style={{ color: t.subtle }}>
                    Member since
                  </p>
                  <p className="text-xs tracking-[0.12em]">{data.memberSince}</p>
                  {!data.statusOk && (
                    <p className="mt-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white">{data.status}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* BACK (only rendered when the card can flip) */}
          {flippable && (
          <section
            aria-label="Membership card back"
            aria-hidden={!flipped}
            className={face}
            style={{ background: t.base, color: t.text, transform: "rotateY(180deg)", boxShadow: `inset 0 0 0 1px ${t.edge}, var(--shadow-card)` }}
          >
            <div className="metal-texture absolute inset-0" aria-hidden />
            <div className="absolute inset-x-0 top-[14%] h-[16%] bg-black/70" aria-hidden />
            <div className="relative flex h-full flex-col justify-end gap-3 p-5 text-xs sm:p-7 sm:text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.24em]" style={{ color: t.subtle }}>Status</dt>
                  <dd>{data.status}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.24em]" style={{ color: t.subtle }}>Valid</dt>
                  <dd>{data.validity ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.24em]" style={{ color: t.subtle }}>Chapter</dt>
                  <dd>{data.chapter ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.24em]" style={{ color: t.subtle }}>Concierge</dt>
                  <dd className="truncate">{data.supportContact ?? "—"}</dd>
                </div>
              </dl>
              <p className="text-[10px] leading-snug" style={{ color: t.subtle }}>
                This card is personal and non-transferable. Membership is subject to the CLUB JOIA 300{" "}
                {data.termsUrl ? (
                  <a href={data.termsUrl} className="underline underline-offset-2" tabIndex={flipped ? 0 : -1}>
                    terms
                  </a>
                ) : (
                  "terms"
                )}
                .
              </p>
            </div>
          </section>
          )}
        </div>
      </div>

      {flippable && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl"
            aria-pressed={flipped}
          >
            <RotateCw className="size-3.5" aria-hidden />
            {flipped ? "Show front" : "Show back"}
          </button>
        </div>
      )}
    </div>
  );
}
