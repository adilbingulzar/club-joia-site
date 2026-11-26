"use client";

import { useOptimistic, useTransition } from "react";
import { Bookmark, Lock, MapPin } from "lucide-react";
import { categoryStyles } from "@/member/styles/design-tokens";
import { cn } from "@/member/lib/utils";
import type { ProgrammeItemView } from "@/member/lib/types";
import type { ActionResult } from "@/member/lib/errors";
import { ProgrammeIcon } from "./programme-icon";

type ToggleFavorite = (id: string) => Promise<ActionResult<{ favorite: boolean }>>;

/** Saved ("marked") items are highlighted in ruby red everywhere they appear. */
const MARKED = "#EF233C";

/** A single programme entry. Pass `favorite` + `onToggle` to control the saved state from a parent. */
export function ProgrammeCard({
  item,
  onToggleFavorite,
  compact,
  favorite,
  onToggle,
}: {
  item: ProgrammeItemView;
  onToggleFavorite?: ToggleFavorite;
  compact?: boolean;
  favorite?: boolean;
  onToggle?: () => void;
}) {
  const cat = categoryStyles[item.category] ?? categoryStyles.OTHER;
  const [optimisticFav, setOptimisticFav] = useOptimistic(item.favorite);
  const [, startTransition] = useTransition();
  const saved = favorite ?? optimisticFav;
  const toggle =
    onToggle ??
    (onToggleFavorite
      ? () =>
          startTransition(async () => {
            setOptimisticFav(!optimisticFav);
            await onToggleFavorite(item.id);
          })
      : undefined);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface transition-colors",
        saved ? "border-ruby/70 shadow-[0_0_0_1px_rgba(239,35,60,0.25)]" : "border-line",
        compact ? "p-4" : "p-5",
      )}
    >
      {saved && <span className="absolute inset-y-0 left-0 w-1 bg-ruby" aria-hidden />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.22em]" style={{ color: cat.color }}>
            <span className="size-1.5 rounded-full" style={{ background: cat.color }} aria-hidden />
            {cat.label}
            {saved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ruby px-2 py-0.5 text-[9px] tracking-[0.18em] text-white">
                <Bookmark className="size-2.5" fill="currentColor" aria-hidden /> Saved
              </span>
            )}
            {item.restricted && (
              <span className="inline-flex items-center gap-1 text-pearl-dim">
                <Lock className="size-3" aria-hidden /> Members of your tier
              </span>
            )}
          </p>
          <h3 className={cn("mt-2 font-display leading-tight text-pearl", compact ? "text-xl" : "text-2xl")}>{item.title}</h3>
          {item.subtitle && <p className="mt-0.5 text-sm text-pearl-muted">{item.subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ProgrammeIcon item={item} color={saved ? MARKED : cat.color} size={compact ? "sm" : "md"} />
          {toggle && (
            <button
              type="button"
              aria-pressed={saved}
              aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
              onClick={toggle}
              className={cn(
                "grid size-10 place-items-center rounded-full border transition-colors",
                saved ? "border-ruby bg-ruby text-white" : "border-line text-pearl-muted hover:text-pearl",
              )}
            >
              <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {!compact && item.description && <p className="mt-3 text-sm leading-relaxed text-pearl-muted">{item.description}</p>}
      {item.location && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-pearl-dim">
          <MapPin className="size-3.5" aria-hidden />
          {item.location}
        </p>
      )}
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded image served by /api/files after an auth check
        <img src={item.image} alt="" className="mt-4 aspect-[16/9] w-full rounded-xl object-cover" />
      )}
    </article>
  );
}

/** One timeline row: owns the optimistic saved state so the dot and the card stay in sync. */
function TimelineRow({ item, onToggleFavorite }: { item: ProgrammeItemView; onToggleFavorite?: ToggleFavorite }) {
  const cat = categoryStyles[item.category] ?? categoryStyles.OTHER;
  const [saved, setSaved] = useOptimistic(item.favorite);
  const [, startTransition] = useTransition();
  const toggle = onToggleFavorite
    ? () =>
        startTransition(async () => {
          setSaved(!saved);
          await onToggleFavorite(item.id);
        })
    : undefined;
  return (
    <li className="relative grid grid-cols-[44px_1fr] gap-4">
      <div className="pt-5 text-right">
        <time dateTime={item.startsAt} className={cn("block font-display text-lg leading-none", saved ? "text-ruby" : "text-pearl")}>
          {item.startTime}
        </time>
        {item.endTime && <span className="mt-1 block text-[10px] text-pearl-dim">{item.endTime}</span>}
      </div>
      <span
        className={cn("absolute rounded-full ring-ink", !saved && "ring-4", saved ? "left-[47px] top-[25px] size-[11px] bg-ruby ring-2 shadow-[0_0_10px_rgba(239,35,60,0.8)]" : "left-[48px] top-[26px] size-[9px]")}
        style={saved ? undefined : { background: cat.color }}
        aria-hidden
      />
      <div className="pl-3">
        <ProgrammeCard item={item} favorite={saved} onToggle={toggle} />
      </div>
    </li>
  );
}

/** Vertical timeline of a day's programme. */
export function ProgrammeTimeline({ items, onToggleFavorite }: { items: ProgrammeItemView[]; onToggleFavorite?: ToggleFavorite }) {
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[52px] before:top-2 before:w-px before:bg-line">
      {items.map((item) => (
        <TimelineRow key={item.id} item={item} onToggleFavorite={onToggleFavorite} />
      ))}
    </ol>
  );
}
