import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MapPin, QrCode } from "lucide-react";
import { page } from "@/member/server/api";
import type { MemberEvent, MemberTicket, Programme } from "@/member/lib/types";
import { EventHero } from "@/member/components/joia/event-hero";
import { PageLoading } from "@/member/components/joia/states";
import { ProgrammePrefetch } from "@/member/components/pwa/programme-prefetch";
import { TicketCard } from "@/member/components/joia/ticket-card";
import { ProgrammeDays } from "./programme-days";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params, searchParams }: PageProps<"/account/events/[slug]">) {
  return (
    <Suspense fallback={<PageLoading label="Loading event" variant="hero" />}>
      <EventContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EventContent({ params, searchParams }: PageProps<"/account/events/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { event, programme, tickets: eventTickets } = await page<{ event: MemberEvent; programme: Programme; tickets: MemberTicket[] }>("event", { slug });
  const initialDay = typeof sp.day === "string" ? sp.day : undefined;

  return (
    <div className="space-y-10 animate-fade-up">
      <ProgrammePrefetch slug={event.slug} />
      <EventHero city={event.city} title={event.info.tagline ?? event.name} start={event.start} end={event.end} heroImage={event.heroImageUrl} />

      {event.description && <p className="font-display text-xl leading-relaxed text-pearl-muted">{event.description}</p>}
      <p className="flex items-center gap-2 text-sm text-pearl-dim">
        <MapPin className="size-4" aria-hidden /> {event.venue}, {event.city}
      </p>

      <section aria-labelledby="prog-h">
        <h2 id="prog-h" className="display mb-5 text-3xl">
          Programme
        </h2>
        <ProgrammeDays days={programme.days} initialDay={initialDay} />
      </section>

      <section aria-labelledby="tix-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="tix-h" className="display text-3xl">
            Your access
          </h2>
          <Link href="/account/tickets" className="text-[10px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl">
            All tickets
          </Link>
        </div>
        {eventTickets.length > 0 ? (
          <div className="space-y-3">
            {eventTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-line p-5 text-sm text-pearl-dim">
            <QrCode className="size-4" aria-hidden /> Your credentials will appear here once issued by CLUB JOIA.
          </p>
        )}
      </section>

      <section aria-labelledby="info-h" className="space-y-4">
        <h2 id="info-h" className="display text-3xl">
          Event information
        </h2>
        {event.info.dressCode && <InfoBlock title="Dress code" body={event.info.dressCode} />}
        {event.info.infoSections?.map((s) => <InfoBlock key={s.title} title={s.title} body={s.body} />)}
        {(event.info.supportEmail || event.info.supportPhone) && (
          <InfoBlock
            title="On-site concierge"
            body={[event.info.supportEmail, event.info.supportPhone].filter(Boolean).join(" · ")}
          />
        )}
      </section>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="eyebrow">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-pearl-muted">{body}</p>
    </div>
  );
}
