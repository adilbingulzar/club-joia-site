import Link from "next/link";
import { ChevronRight, QrCode } from "lucide-react";
import { cn } from "@/member/lib/utils";
import { StatusBadge } from "./badges";

type TicketLike = {
  ticketNumber: string;
  effectiveStatus: string;
  validFrom: Date;
  validUntil: Date;
  event: { name: string; timezone: string };
  ticketType: { name: string; zones: { zone: { name: string } }[] };
  checkIns?: { checkedInAt: Date }[];
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ready",
  USED: "Used",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

/** A ticket as an entitlement of membership — quiet, secondary to the card. */
export function TicketCard({ ticket, className }: { ticket: TicketLike; className?: string }) {
  const usable = ticket.effectiveStatus === "ACTIVE";
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: ticket.event.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  return (
    <Link
      href={`/account/tickets/${ticket.ticketNumber}`}
      className={cn("group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-pearl/25", !usable && "opacity-70", className)}
    >
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", usable ? "bg-pearl text-ink" : "bg-surface-raised text-pearl-dim")}>
        <QrCode className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-xl leading-tight">{ticket.ticketType.name}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-pearl-dim">
          {fmt(ticket.validFrom)} → {fmt(ticket.validUntil)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.effectiveStatus} label={STATUS_LABEL[ticket.effectiveStatus]} />
          <span className="truncate text-[10px] uppercase tracking-[0.16em] text-pearl-dim">{ticket.ticketType.zones.map((z) => z.zone.name).join(" · ")}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-pearl-dim transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
