import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConciergeBell, Plus } from "lucide-react";
import { page } from "@/member/server/api";
import type { ConciergeSummary } from "@/member/lib/types";
import { OPEN_CONCIERGE_STATUSES } from "@/member/domain/concierge";
import { ConciergeRequestCard } from "@/member/components/joia/concierge-request-card";
import { EmptyState, PageLoading } from "@/member/components/joia/states";
import { buttonClasses } from "@/member/components/ui/button-styles";

export const metadata: Metadata = { title: "Concierge" };

export default function ConciergePage() {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">At your service</p>
          <h1 className="display mt-2 text-5xl">Concierge</h1>
        </div>
        <Link href="/account/concierge/new" className={buttonClasses("primary", "sm")}>
          <Plus className="size-4" aria-hidden /> Request
        </Link>
      </header>
      <Suspense fallback={<PageLoading label="Loading requests" />}>
        <Requests />
      </Suspense>
    </div>
  );
}

async function Requests() {
  const { requests } = await page<{ requests: ConciergeSummary[] }>("concierge-list");
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<ConciergeBell />}
        title="How may we help?"
        description="Transfers, tables, yachts, hotels — tell us what you need and the CLUB JOIA concierge team will take care of it."
        action={{ href: "/account/concierge/new", label: "Make a request" }}
      />
    );
  }
  const open = requests.filter((r) => OPEN_CONCIERGE_STATUSES.includes(r.status));
  const closed = requests.filter((r) => !OPEN_CONCIERGE_STATUSES.includes(r.status));
  return (
    <div className="space-y-8">
      {open.length > 0 && (
        <section aria-label="Open requests" className="space-y-3">
          <p className="eyebrow">Open</p>
          {open.map((r) => (
            <ConciergeRequestCard key={r.id} request={r} />
          ))}
        </section>
      )}
      {closed.length > 0 && (
        <section aria-label="Past requests" className="space-y-3">
          <p className="eyebrow">Past</p>
          {closed.map((r) => (
            <ConciergeRequestCard key={r.id} request={r} />
          ))}
        </section>
      )}
    </div>
  );
}
