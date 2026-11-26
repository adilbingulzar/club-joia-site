import type { Metadata } from "next";
import { Suspense } from "react";
import { page } from "@/member/server/api";
import { LoadingSkeleton } from "@/member/components/joia/states";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "New concierge request" };

export default function NewConciergePage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Concierge</p>
        <h1 className="display mt-2 text-5xl">New request</h1>
        <p className="mt-3 text-sm text-pearl-muted">Our team responds personally, usually within the hour during event days.</p>
      </header>
      <Suspense fallback={<LoadingSkeleton variant="list" lines={5} />}>
        <FormLoader />
      </Suspense>
    </div>
  );
}

async function FormLoader() {
  const event = await page<{ eventId: string | null; eventStart: string | null }>("concierge-new");
  return <NewRequestForm eventId={event.eventId ?? undefined} eventStart={event.eventStart ?? undefined} />;
}
