import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Paperclip } from "lucide-react";
import { redirect } from "next/navigation";
import { call } from "@/member/server/api";
import type { ConciergeRequest } from "@/member/lib/types";
import { CONCIERGE_CATEGORY_LABELS, CONCIERGE_STATUS_LABELS, memberCanCancel, memberCanReply } from "@/member/domain/concierge";
import { StatusBadge } from "@/member/components/joia/badges";
import { EmptyState, PageLoading } from "@/member/components/joia/states";
import { FormMessage } from "@/member/components/ui/form";
import { formatDateOnly, dateOnly } from "@/member/lib/time";
import { cn } from "@/member/lib/utils";
import { CancelRequestButton, ReplyForm } from "./request-actions";

export const metadata: Metadata = { title: "Concierge request" };

export default function RequestPage({ params, searchParams }: PageProps<"/account/concierge/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/account/concierge" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl">
        <ChevronLeft className="size-4" aria-hidden /> Concierge
      </Link>
      <Suspense fallback={<PageLoading label="Loading request" />}>
        <RequestContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RequestContent({ params, searchParams }: PageProps<"/account/concierge/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await call("concierge-get", { id });
  if (!r.ok) {
    if (r.status === 401) redirect("/login");
    if (r.status === 404) return <EmptyState title="Request not found" action={{ href: "/account/concierge", label: "Your requests" }} />;
    throw new Error(r.error.message);
  }
  const { request } = r.data as { request: ConciergeRequest };

  return (
    <div className="space-y-8 animate-fade-up">
      {sp.created === "1" && <FormMessage success="Request received. Our concierge team will be in touch shortly." />}
      <header>
        <p className="eyebrow">
          {CONCIERGE_CATEGORY_LABELS[request.category]} · {request.reference}
        </p>
        <h1 className="display mt-2 text-4xl">{request.subject}</h1>
        <div className="mt-3">
          <StatusBadge status={request.status} label={CONCIERGE_STATUS_LABELS[request.status]} />
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Detail label="Date" value={request.preferredDate ? formatDateOnly(dateOnly(request.preferredDate), { day: "numeric", month: "short" }) : "—"} />
        <Detail label="Time" value={request.preferredTime ?? "—"} />
        <Detail label="Guests" value={request.numberOfPeople?.toString() ?? "—"} />
      </dl>

      <ol aria-label="Conversation" className="space-y-4">
        <Message mine author="You" at={request.createdAt} text={request.description + (request.notes ? `\n\nNotes: ${request.notes}` : "")} />
        {request.messages.map((m) =>
          m.senderType === "SYSTEM" ? (
            <li key={m.id} className="text-center text-[10px] uppercase tracking-[0.2em] text-pearl-dim">
              {m.message}
            </li>
          ) : (
            <Message key={m.id} mine={m.senderType === "MEMBER"} author={m.sender?.name ?? "CLUB JOIA Concierge"} at={m.createdAt} text={m.message} attachment={m.attachmentKey ? { key: m.attachmentKey, name: m.attachmentName ?? "Attachment" } : undefined} />
          ),
        )}
      </ol>

      {memberCanReply(request.status) ? (
        <ReplyForm requestId={request.id} />
      ) : (
        <p className="rounded-2xl border border-line p-4 text-center text-sm text-pearl-dim">This request is closed. Need anything else? <Link href="/account/concierge/new" className="text-ruby">Make a new request</Link>.</p>
      )}
      {memberCanCancel(request.status) && <CancelRequestButton requestId={request.id} />}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="text-[9px] uppercase tracking-[0.2em] text-pearl-dim">{label}</dt>
      <dd className="mt-1 text-pearl">{value}</dd>
    </div>
  );
}

function Message({ mine, author, at, text, attachment }: { mine: boolean; author: string; at: Date; text: string; attachment?: { key: string; name: string } }) {
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed", mine ? "rounded-br-sm bg-pearl text-ink" : "rounded-bl-sm border border-line bg-surface text-pearl")}>
        {text}
        {attachment && (
          <a href={`/account/files/${attachment.key}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs underline underline-offset-2">
            <Paperclip className="size-3.5" aria-hidden /> {attachment.name}
          </a>
        )}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-pearl-dim">
        {author} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(at)}
      </p>
    </li>
  );
}
