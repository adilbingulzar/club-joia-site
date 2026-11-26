"use client";

import { useActionState, useState } from "react";
import { Car, Hotel, Martini, Sailboat, Sparkles, Ticket, UtensilsCrossed, Ellipsis } from "lucide-react";
import { SubmitButton } from "@/member/components/ui/button";
import { FormMessage, TextArea, TextField } from "@/member/components/ui/form";
import { CONCIERGE_CATEGORY_LABELS } from "@/member/domain/concierge";
import { cn } from "@/member/lib/utils";
import { createConciergeAction, type ConciergeFormState } from "@/member/server/actions";

const CATEGORIES = [
  { value: "TRANSPORT", icon: Car },
  { value: "DINING", icon: UtensilsCrossed },
  { value: "HOTEL", icon: Hotel },
  { value: "YACHT", icon: Sailboat },
  { value: "NIGHTLIFE", icon: Martini },
  { value: "TICKET_SUPPORT", icon: Ticket },
  { value: "SPECIAL_REQUEST", icon: Sparkles },
  { value: "OTHER", icon: Ellipsis },
] as const;

export function NewRequestForm({ eventId, eventStart }: { eventId?: string; eventStart?: string }) {
  const [state, action] = useActionState<ConciergeFormState, FormData>(createConciergeAction, undefined);
  const [category, setCategory] = useState<string>("");
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6" noValidate>
      {state && !state.ok && <FormMessage error={{ ...state.error, message: `We couldn’t send your request. ${state.error.message}` }} />}
      {eventId && <input type="hidden" name="eventId" value={eventId} />}

      <fieldset>
        <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-pearl-muted">
          Category <span className="text-ruby" aria-hidden>*</span>
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map(({ value, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-1 py-3 text-center text-[9px] font-medium uppercase leading-tight tracking-[0.12em] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ruby",
                category === value ? "border-pearl bg-pearl text-ink" : "border-line text-pearl-muted hover:text-pearl",
              )}
            >
              <input type="radio" name="category" value={value} className="sr-only" checked={category === value} onChange={() => setCategory(value)} />
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
              {CONCIERGE_CATEGORY_LABELS[value]}
            </label>
          ))}
        </div>
        {fe?.category && <p className="mt-2 text-xs text-ruby">{fe.category[0]}</p>}
      </fieldset>

      <TextField label="Subject" name="subject" required maxLength={120} placeholder="e.g. Dinner for four on Saturday" error={fe?.subject} />
      <TextArea label="Your request" name="description" required maxLength={3000} placeholder="Tell us everything that matters — timings, preferences, names." error={fe?.description} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Preferred date" name="preferredDate" type="date" defaultValue={eventStart} error={fe?.preferredDate} />
        <TextField label="Time" name="preferredTime" type="time" error={fe?.preferredTime} />
      </div>
      <TextField label="Number of people" name="numberOfPeople" type="number" inputMode="numeric" min={1} max={50} error={fe?.numberOfPeople} />
      <TextArea label="Notes" name="notes" maxLength={1000} hint="Optional — anything else we should know." className="[&_textarea]:min-h-20" />
      <TextField label="Attachment" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hint="Optional · JPG, PNG, WebP or PDF up to 8 MB" className="[&_input]:pt-3" />

      <SubmitButton size="lg" className="w-full" pendingLabel="Sending">
        Send to concierge
      </SubmitButton>
    </form>
  );
}
