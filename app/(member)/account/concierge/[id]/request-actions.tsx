"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/member/components/ui/button";
import { FormMessage } from "@/member/components/ui/form";
import { ConfirmDialog } from "@/member/components/joia/confirm-dialog";
import type { ActionError } from "@/member/lib/errors";
import { cancelConciergeAction, sendConciergeMessageAction, type FormState } from "@/member/server/actions";

export function ReplyForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendConciergeMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      {state && !state.ok && <FormMessage error={state.error} />}
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="reply" className="sr-only">
        Message concierge
      </label>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-ruby">
        <textarea id="reply" name="message" required maxLength={3000} rows={2} placeholder="Message concierge…" className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-pearl outline-none placeholder:text-pearl-dim" />
        <label className="grid size-10 cursor-pointer place-items-center rounded-full text-pearl-muted hover:text-pearl" title="Attach a file">
          <Paperclip className="size-4" aria-hidden />
          <span className="sr-only">Attach a file</span>
          <input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" />
        </label>
        <Button type="submit" size="sm" loading={pending} aria-label="Send message" className="size-10 px-0">
          {!pending && <Send className="size-4" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="text-center">
      <FormMessage error={error} />
      <button onClick={() => setOpen(true)} className="text-[11px] uppercase tracking-[0.2em] text-pearl-dim hover:text-ruby">
        Cancel this request
      </button>
      <ConfirmDialog
        open={open}
        title="Cancel request?"
        description="The concierge team will stop working on it. You can always make a new request."
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await cancelConciergeAction(requestId);
            setOpen(false);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      />
    </div>
  );
}
