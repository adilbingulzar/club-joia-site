import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CONCIERGE_CATEGORY_LABELS, CONCIERGE_STATUS_LABELS } from "@/member/domain/concierge";
import type { ConciergeCategory, ConciergeStatus } from "@/member/lib/enums";
import { StatusBadge } from "./badges";

export function ConciergeRequestCard({
  request,
}: {
  request: { id: string; reference: string; subject: string; category: ConciergeCategory; status: ConciergeStatus; updatedAt: Date };
}) {
  return (
    <Link href={`/account/concierge/${request.id}`} className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-pearl/25">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-pearl-dim">
          {CONCIERGE_CATEGORY_LABELS[request.category]} · {request.reference}
        </p>
        <p className="mt-1.5 truncate font-display text-xl leading-tight text-pearl">{request.subject}</p>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge status={request.status} label={CONCIERGE_STATUS_LABELS[request.status]} />
          <span className="text-[11px] text-pearl-dim">
            {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(request.updatedAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 text-pearl-dim transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
