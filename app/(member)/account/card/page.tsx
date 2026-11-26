import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QrCode } from "lucide-react";
import { page } from "@/member/server/api";
import type { Membership, MemberTicket, Settings } from "@/member/lib/types";
import { MetalMembershipCard } from "@/member/components/joia/metal-membership-card";
import { StatusBadge } from "@/member/components/joia/badges";
import { LoadingSkeleton } from "@/member/components/joia/states";
import { membershipCardData } from "@/member/components/member/card-data";
import { MEMBERSHIP_STATUS_LABELS } from "@/member/domain/membership";

export const metadata: Metadata = { title: "Membership card" };

export default function CardPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="space-y-8">
          <span className="sr-only">Loading your card…</span>
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton lines={4} />
        </div>
      }
    >
      <CardContent />
    </Suspense>
  );
}

async function CardContent() {
  const { membership: m, settings, tickets } = await page<{ membership: Membership; settings: Settings; tickets: MemberTicket[] }>("card");
  const next = tickets.find((t) => t.effectiveStatus === "ACTIVE");

  return (
    <div className="space-y-10 animate-fade-up">
      <header className="text-center">
        <p className="eyebrow">Your membership</p>
        <h1 className="display mt-2 text-4xl">{m.membership?.tier.displayName ?? "Member"}</h1>
      </header>

      <MetalMembershipCard data={membershipCardData(m, settings)} />

      {m.membership && m.membership.status !== "ACTIVE" && (
        <p role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-pearl">
          Your membership is currently <strong>{MEMBERSHIP_STATUS_LABELS[m.membership.status].toLowerCase()}</strong>. Access credentials are paused — please contact concierge.
        </p>
      )}

      {next && (
        <Link href={`/account/tickets/${next.ticketNumber}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4">
          <span>
            <span className="eyebrow block">Quick access</span>
            <span className="mt-1 block font-display text-xl">{next.ticketType.name}</span>
          </span>
          <QrCode className="size-7 text-pearl" strokeWidth={1.4} aria-hidden />
        </Link>
      )}

      <section aria-labelledby="priv-h">
        <h2 id="priv-h" className="display text-3xl">
          Your privileges
        </h2>
        {m.membership?.tier.description && <p className="mt-2 text-sm text-pearl-muted">{m.membership.tier.description}</p>}
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {m.privileges.map((p) => (
            <li key={p.code} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-[15px] text-pearl">{p.name}</p>
                {p.description && <p className="mt-0.5 text-xs text-pearl-dim">{p.description}</p>}
              </div>
              <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-pearl-muted">
                {typeof p.value === "boolean" ? (p.value ? "Included" : "—") : String(p.value)}
              </span>
            </li>
          ))}
          {m.privileges.length === 0 && <li className="py-4 text-sm text-pearl-dim">Privileges are activated when your membership is active.</li>}
        </ul>
      </section>

      {m.membership && (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="eyebrow">Status</dt>
            <dd className="mt-2">
              <StatusBadge status={m.membership.status} label={MEMBERSHIP_STATUS_LABELS[m.membership.status]} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Number</dt>
            <dd className="mt-2 font-mono tracking-[0.12em] text-pearl">{m.membership.membershipNumber}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
