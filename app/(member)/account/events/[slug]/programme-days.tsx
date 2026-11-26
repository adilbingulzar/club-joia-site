"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { ProgrammeTimeline } from "@/member/components/joia/programme";
import { EmptyState } from "@/member/components/joia/states";
import { cn } from "@/member/lib/utils";
import type { ProgrammeItemView } from "@/member/lib/types";
import { toggleFavoriteAction } from "@/member/server/actions";

function dayLabel(date: string, part: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...part, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Friday / Saturday / Sunday tabs over the programme timeline. */
export function ProgrammeDays({ days, initialDay }: { days: { date: string; items: ProgrammeItemView[] }[]; initialDay?: string }) {
  const [active, setActive] = useState(days.find((d) => d.date === initialDay)?.date ?? days[0]?.date);
  const day = days.find((d) => d.date === active);
  const hasSample = days.some((d) => d.items.some((i) => i.isSample));

  return (
    <div>
      <div role="tablist" aria-label="Programme days" className="mb-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const selected = d.date === active;
          const savedCount = d.items.filter((i) => i.favorite).length;
          return (
            <button
              key={d.date}
              role="tab"
              id={`tab-${d.date}`}
              aria-selected={selected}
              aria-controls={`panel-${d.date}`}
              onClick={() => setActive(d.date)}
              className={cn(
                "relative rounded-2xl border px-2 py-3 text-center transition-colors",
                selected ? "border-pearl bg-pearl text-ink" : "border-line text-pearl-muted hover:text-pearl",
              )}
            >
              {savedCount > 0 && (
                <span className="absolute right-2 top-2 grid min-w-4 place-items-center rounded-full bg-ruby px-1 text-[9px] font-semibold leading-4 text-white" aria-label={`${savedCount} saved`}>
                  {savedCount}
                </span>
              )}
              <span className="block text-[10px] font-medium uppercase tracking-[0.22em]">{dayLabel(d.date, { weekday: "long" })}</span>
              <span className="mt-1 block font-display text-2xl leading-none">{Number(d.date.slice(8, 10))}</span>
              <span className="block text-[9px] uppercase tracking-[0.2em] opacity-70">{dayLabel(d.date, { month: "short" })}</span>
            </button>
          );
        })}
      </div>
      {hasSample && (
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-pearl-dim">Provisional programme · times subject to confirmation</p>
      )}
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {day && day.items.length > 0 ? (
          <ProgrammeTimeline items={day.items} onToggleFavorite={toggleFavoriteAction} />
        ) : (
          <EmptyState icon={<CalendarX />} title="To be announced" description="The programme for this day will be published soon." />
        )}
      </div>
    </div>
  );
}
