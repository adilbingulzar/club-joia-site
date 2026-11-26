import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, CalendarDays, ConciergeBell, CreditCard, QrCode } from "lucide-react";
import { formatDateOnly, weekdayName } from "@/member/lib/time";
import { page } from "@/member/server/api";
import type { Membership, MemberEvent, MemberTicket, Programme, ProgrammeItemView, Settings } from "@/member/lib/types";
import type { ConciergeStatus } from "@/member/lib/enums";
import { CONCIERGE_STATUS_LABELS, OPEN_CONCIERGE_STATUSES } from "@/member/domain/concierge";
import { Greeting } from "@/member/components/member/greeting";
import { EventHero } from "@/member/components/joia/event-hero";
import { Countdown } from "@/member/components/joia/countdown";
import { MetalMembershipCard } from "@/member/components/joia/metal-membership-card";
import { ProgrammeCard } from "@/member/components/joia/programme";
import { StatusBadge } from "@/member/components/joia/badges";
import { LoadingSkeleton } from "@/member/components/joia/states";
import { membershipCardData } from "@/member/components/member/card-data";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">Loading your membership…</span>
      <div className="skeleton h-12 w-1/2" aria-hidden />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="hero" />
    </div>
  );
}

async function Home() {
  const { membership, event, tickets, settings, latestRequest, programme, summary, countdownTarget } = await page<{
    membership: Membership; event: MemberEvent | null; tickets: MemberTicket[]; settings: Settings;
    latestRequest: { id: string; subject: string; status: ConciergeStatus } | null; programme: Programme | null;
    summary: { today: string; todays: ProgrammeItemView[]; next: ProgrammeItemView | null } | null; countdownTarget: string | null;
  }>("home");
  const nextTicket = tickets.find((t) => t.effectiveStatus === "ACTIVE");
  const isEventDay = Boolean(summary && summary.todays.length > 0);
  const previewDay = programme?.days.find((d) => d.items.length > 0);
  const featuredItems = isEventDay ? summary!.todays.filter((i) => new Date(i.endsAt ?? i.startsAt) > new Date()).slice(0, 3) : previewDay?.items.slice(0, 3) ?? [];

  return (
    <div className="space-y-10 animate-fade-up">
      <Greeting firstName={membership.member.displayName || membership.member.firstName} />

      {/* Membership first: the card is the heart of the experience. */}
      {membership.membership ? (
        <Link href="/account/card" aria-label="Open your membership card" className="block">
          <MetalMembershipCard data={membershipCardData(membership, settings)} flippable={false} size="compact" />
        </Link>
      ) : (
        <p className="rounded-2xl border border-line p-5 text-sm text-pearl-muted">Your membership is being prepared by CLUB JOIA concierge.</p>
      )}

      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2">
        {[
          { href: nextTicket ? `/account/tickets/${nextTicket.ticketNumber}` : "/account/tickets", label: "Ticket", icon: QrCode },
          { href: event ? `/account/events/${event.slug}` : "/account/events", label: "Programme", icon: CalendarDays },
          { href: "/account/concierge/new", label: "Concierge", icon: ConciergeBell },
          { href: "/account/card", label: "Membership", icon: CreditCard },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-4 text-[9.5px] font-medium uppercase tracking-[0.16em] text-pearl-muted transition-colors hover:text-pearl">
            <Icon className="size-5 text-pearl" strokeWidth={1.5} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      {event && (
        <EventHero city={event.city} title={event.info.tagline ?? event.name} start={event.start} end={event.end} heroImage={event.heroImageUrl} href={`/account/events/${event.slug}`}>
          {countdownTarget && <Countdown target={countdownTarget} label={`Countdown to ${weekdayName(event.start)}`} />}
        </EventHero>
      )}

      {event && (
        <section aria-labelledby="programme-h">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow">{isEventDay ? "Today" : previewDay ? weekdayName(previewDay.date) : "Programme"}</p>
              <h2 id="programme-h" className="display mt-1 text-3xl">
                {isEventDay ? "Today’s programme" : "The weekend begins"}
              </h2>
            </div>
            <Link href={`/account/events/${event.slug}`} className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl">
              Full programme <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>
          {featuredItems.length > 0 ? (
            <div className="space-y-3">
              {featuredItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[56px_1fr] items-start gap-3">
                  <time dateTime={item.startsAt} className="pt-4 font-display text-xl text-pearl">
                    {item.startTime}
                  </time>
                  <ProgrammeCard item={item} compact />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-pearl-dim">The programme will be published soon.</p>
          )}
        </section>
      )}

      <section aria-label="At a glance" className="grid grid-cols-2 gap-3">
        <Link href={summary?.next ? `/account/events/${event!.slug}?day=${summary.next.date}` : "/account/events"} className="rounded-2xl border border-line bg-surface p-4">
          <p className="eyebrow">Next up</p>
          {summary?.next ? (
            <>
              <p className="mt-3 font-display text-xl leading-tight">{summary.next.title}</p>
              <p className="mt-1 text-xs text-pearl-dim">
                {formatDateOnly(summary.next.date, { weekday: "short", day: "numeric", month: "short" })} · {summary.next.startTime}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-pearl-dim">Nothing scheduled.</p>
          )}
        </Link>
        <Link href={latestRequest ? `/account/concierge/${latestRequest.id}` : "/account/concierge/new"} className="rounded-2xl border border-line bg-surface p-4">
          <p className="eyebrow">Concierge</p>
          {latestRequest ? (
            <>
              <p className="mt-3 line-clamp-2 font-display text-xl leading-tight">{latestRequest.subject}</p>
              <StatusBadge className="mt-2" status={latestRequest.status} label={CONCIERGE_STATUS_LABELS[latestRequest.status]} tone={OPEN_CONCIERGE_STATUSES.includes(latestRequest.status) ? undefined : "neutral"} />
            </>
          ) : (
            <p className="mt-3 text-sm text-pearl-dim">At your service — make a request.</p>
          )}
        </Link>
      </section>
    </div>
  );
}
