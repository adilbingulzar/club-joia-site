import type { Metadata } from "next";
import { Suspense } from "react";
import { Ticket } from "lucide-react";
import { page } from "@/member/server/api";
import type { MemberTicket } from "@/member/lib/types";
import { TicketCard } from "@/member/components/joia/ticket-card";
import { EmptyState, PageLoading } from "@/member/components/joia/states";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Access credentials</p>
        <h1 className="display mt-2 text-5xl">Tickets</h1>
      </header>
      <Suspense fallback={<PageLoading label="Loading tickets" />}>
        <TicketList />
      </Suspense>
    </div>
  );
}

async function TicketList() {
  const { tickets } = await page<{ tickets: MemberTicket[] }>("tickets");
  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<Ticket />}
        title="No tickets yet"
        description="CLUB JOIA will issue your access credentials ahead of the weekend. We’ll notify you the moment they’re ready."
        action={{ href: "/account/concierge/new", label: "Ask concierge" }}
      />
    );
  }
  // grouped by event (Map.groupBy needs Node 21+)
  const byEvent = new Map<string, MemberTicket[]>();
  for (const t of tickets) byEvent.set(t.event.name, [...(byEvent.get(t.event.name) ?? []), t]);
  return (
    <div className="space-y-8">
      {[...byEvent.entries()].map(([eventName, list]) => (
        <section key={eventName} aria-label={eventName}>
          <p className="eyebrow mb-3">{eventName}</p>
          <div className="space-y-3">
            {list.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
