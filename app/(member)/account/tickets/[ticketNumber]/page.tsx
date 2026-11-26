import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { call } from "@/member/server/api";
import { redirect } from "next/navigation";
import type { Membership, MemberTicket } from "@/member/lib/types";
import { StatusBadge, TierBadge } from "@/member/components/joia/badges";
import { EmptyState, LoadingSkeleton } from "@/member/components/joia/states";
import { QRCodeDisplay } from "@/member/components/joia/qr-code-display";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/account/tickets/[ticketNumber]">) {
  return (
    <div className="space-y-6">
      <Link href="/account/tickets" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl">
        <ChevronLeft className="size-4" aria-hidden /> Tickets
      </Link>
      <Suspense
        fallback={
          <div role="status" className="space-y-6">
            <span className="sr-only">Loading ticket…</span>
            <div className="skeleton mx-auto aspect-square w-full max-w-[320px] rounded-3xl" aria-hidden />
            <LoadingSkeleton lines={3} />
          </div>
        }
      >
        <TicketContent params={params} />
      </Suspense>
    </div>
  );
}

async function TicketContent({ params }: Pick<PageProps<"/account/tickets/[ticketNumber]">, "params">) {
  const { ticketNumber } = await params;
  const r = await call("ticket", { ticketNumber: decodeURIComponent(ticketNumber) });
  if (!r.ok) {
    if (r.status === 401) redirect("/login");
    if (r.status === 404) {
      return <EmptyState title="Ticket not found" description="This ticket doesn’t exist or isn’t linked to your membership." action={{ href: "/account/tickets", label: "Your tickets" }} />;
    }
    throw new Error(r.error.message);
  }
  const { ticket, membership } = r.data as { ticket: MemberTicket; membership: Membership };
  const tz = ticket.event.timezone;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="text-center">
        <p className="eyebrow">{ticket.event.name}</p>
        <h1 className="display mt-2 text-4xl">{ticket.ticketType.name}</h1>
        <div className="mt-3 flex items-center justify-center gap-2">
          {membership.membership && <TierBadge name={membership.membership.tier.displayName} theme={membership.membership.tier.cardTheme} />}
          <StatusBadge status={ticket.effectiveStatus} />
        </div>
      </header>

      <QRCodeDisplay ticketNumber={ticket.ticketNumber} status={ticket.effectiveStatus} />

      <dl className="divide-y divide-line border-y border-line text-sm">
        <Row label="Member" value={`${membership.member.firstName} ${membership.member.lastName}`} />
        <Row label="Valid from" value={fmt(ticket.validFrom)} />
        <Row label="Valid until" value={fmt(ticket.validUntil)} />
        <Row label="Access" value={ticket.ticketType.zones.map((z) => z.zone.name).join(", ")} />
        <Row label="Venue" value={`${ticket.event.venue}, ${ticket.event.city}`} />
        {ticket.checkIns.length > 0 && <Row label="Last check-in" value={`${ticket.checkIns[0].zone.name}, ${fmt(ticket.checkIns[0].checkedInAt)}`} />}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-3.5">
      <dt className="text-pearl-dim">{label}</dt>
      <dd className="text-right text-pearl">{value}</dd>
    </div>
  );
}
